import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AdminModerateListingsPanel from "./AdminModerateListingsPanel";
import RatingPromptModal from "./RatingPromptModal";
import ReceiptModal from "./ReceiptModal";
import StaffManagementPanel from "./StaffManagementPanel";
import { NotificationProvider } from "../context/NotificationContext";
import { generateTransactionReceiptPdf } from "../utils/receiptPdf";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
  signUp: vi.fn(),
  doc: {
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    },
    setFillColor: vi.fn(),
    roundedRect: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    splitTextToSize: vi.fn((value) => [String(value)]),
    addImage: vi.fn(),
    save: vi.fn(),
  },
}));

const staffRows = [
  {
    id: "staff-1",
    display_name: "Ops Lead",
    name: "Operations Lead",
    email: "ops@example.edu",
    role: "staff",
    status: "active",
    created_at: "2026-01-10T00:00:00.000Z",
    phone_number: "0712345678",
  },
  {
    id: "staff-2",
    display_name: "Dorm Desk",
    name: "Dorm Desk",
    email: "desk@example.edu",
    role: "staff",
    status: "inactive",
    created_at: "2026-02-10T00:00:00.000Z",
  },
];

function makeSupabaseQuery(table) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () =>
      Promise.resolve({
        data: table === "profiles" ? staffRows : [],
        error: null,
      }),
    insert: (payload) => {
      mocks.insert(table, payload);
      return Promise.resolve({ error: null });
    },
    update: (payload) => {
      mocks.update(table, payload);
      return query;
    },
    delete: () => {
      mocks.delete(table);
      return query;
    },
    upsert: (payload) => {
      mocks.upsert(table, payload);
      return Promise.resolve({ error: null });
    },
  };
  return query;
}

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: (table) => makeSupabaseQuery(table),
    auth: {
      signUp: (...args) => mocks.signUp(...args),
    },
  },
}));

vi.mock("../data/listings", () => ({
  CATEGORIES: [
    { label: "All Items" },
    { label: "Electronics" },
    { label: "Textbooks" },
  ],
  CONDITIONS: ["All Conditions", "New", "Like New", "Good", "Fair", "Poor"],
  CONDITION_COLORS: {
    New: "#1F6B52",
    "Like New": "#7D8F86",
    Good: "#E59D3A",
    Fair: "#C75B4A",
    Poor: "#A0AAA2",
  },
}));

vi.mock("jspdf", () => ({
  default: vi.fn(function MockJsPdf() {
    return mocks.doc;
  }),
}));

function renderWithNotifications(ui) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
  mocks.signUp.mockResolvedValue({
    data: { user: { id: "new-staff-1" } },
    error: null,
  });
});

describe("AdminModerateListingsPanel coverage", () => {
  const listings = [
    {
      id: "listing-1",
      title: "Graphing Calculator",
      price: "R 900",
      condition: "Good",
      category: "Electronics",
      seller: "Amina",
      status: "flagged",
      listing_type: "sale_and_trade",
      institution: "UCT",
      approximate_location: "Library",
      joined_label: "Jan 2026",
      created_at: "2026-03-01T00:00:00.000Z",
      flag_reason: "Buyer reported suspicious payment request.",
    },
    {
      id: "listing-2",
      title: "Biology Textbook",
      price: "R 250",
      condition: "Like New",
      category: "Textbooks",
      seller: "Neo",
      status: "active",
      listing_type: "sale",
      created_at: "bad-date",
    },
  ];

  test("filters, sorts, reports counts, and opens moderation review", () => {
    const onModerateListing = vi.fn();
    render(
      <AdminModerateListingsPanel
        listings={listings}
        onModerateListing={onModerateListing}
      />,
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Buyer reported suspicious payment request.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "calculator" } });
    expect(screen.getByText("Graphing Calculator")).toBeInTheDocument();
    expect(screen.queryByText("Biology Textbook")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText(/min price/i), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText(/max price/i), { target: { value: "950" } });

    fireEvent.click(screen.getByRole("button", { name: /review moderation/i }));
    expect(onModerateListing).toHaveBeenCalledWith(expect.objectContaining({ id: "listing-1" }));
  });

  test("renders loading, error, and empty states", () => {
    const { rerender } = render(<AdminModerateListingsPanel loading listings={[]} />);
    expect(screen.getByRole("heading", { name: /loading listings/i })).toBeInTheDocument();

    rerender(<AdminModerateListingsPanel error="Could not load listings" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load listings");

    rerender(<AdminModerateListingsPanel listings={[]} />);
    expect(screen.getByRole("heading", { name: /no listings match/i })).toBeInTheDocument();
  });
});

describe("RatingPromptModal coverage", () => {
  const transaction = {
    id: "txn-1",
    item: "Desk Lamp",
    listing_id: "listing-1",
    seller_id: "seller-1",
    otherUserId: "buyer-1",
    otherUserName: "Buyer Person",
    role: "seller",
  };

  test("submits a rating and clears the seller pending flag", async () => {
    const onDone = vi.fn();
    render(
      <RatingPromptModal
        pendingRatings={[transaction]}
        currentUserId="seller-1"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /5 stars/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit rating/i }));

    await waitFor(() =>
      expect(mocks.insert).toHaveBeenCalledWith(
        "ratings",
        expect.objectContaining({
          rater_id: "seller-1",
          rated_id: "buyer-1",
          rating: 5,
        }),
      ),
    );
    expect(mocks.update).toHaveBeenCalledWith("transactions", { seller_rating_pending: false });
    expect(onDone).toHaveBeenCalledWith("txn-1", true);
  });

  test("shows validation and database errors without dismissing", async () => {
    const onDone = vi.fn();
    render(
      <RatingPromptModal
        pendingRatings={[{ ...transaction, listing_id: null }]}
        currentUserId="buyer-1"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /3 stars/i }));
    fireEvent.click(screen.getByRole("button", { name: /submit rating/i }));
    expect(await screen.findByText(/missing a listing reference/i)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("Receipt tools coverage", () => {
  const transaction = {
    id: "txn-1",
    item: "Desk Lamp",
    price: 250,
    totalAmount: 250,
    status: "completed",
    createdAt: "2026-04-10T12:00:00.000Z",
    seller: { name: "Seller", studentId: "seller@example.edu" },
    buyer: { name: "Buyer", studentId: "buyer@example.edu" },
    dropoffFacility: "Main Trade Desk",
    itemDescription: "A sturdy desk lamp.",
  };

  test("searches, selects, and generates a receipt from the modal", async () => {
    const onGenerate = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(
      <ReceiptModal
        transactions={[transaction, { ...transaction, id: "txn-2", item: "Textbook" }]}
        generatingId=""
        onGenerate={onGenerate}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /download receipt/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/select a transaction/i);

    fireEvent.change(screen.getByLabelText(/search transactions/i), {
      target: { value: "textbook" },
    });
    expect(screen.getByText("1 result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /txn-2/i }));
    expect(screen.getByText(/selected transaction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download receipt/i }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ id: "txn-2" })));

    fireEvent.click(screen.getByRole("button", { name: /close receipt generator/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test("generates sale and trade PDFs while tolerating missing images", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await generateTransactionReceiptPdf(transaction);
    expect(mocks.doc.save).toHaveBeenCalledWith("trade-facility-receipt-txn-1.pdf");
    expect(mocks.doc.text).toHaveBeenCalledWith("Image unavailable", expect.any(Number), expect.any(Number));

    await generateTransactionReceiptPdf({
      ...transaction,
      id: "txn-trade",
      transaction_type: "item_trade",
      requested_item: "Desk Lamp",
      offered_item: "Textbook",
      itemImageUrl: "",
    });
    expect(mocks.doc.text).toHaveBeenCalledWith(["Item trade"], expect.any(Number), expect.any(Number));
  });
});

describe("StaffManagementPanel coverage", () => {
  test("loads staff, searches, creates, toggles, and deletes staff accounts", async () => {
    renderWithNotifications(<StaffManagementPanel />);

    expect(await screen.findByText("Ops Lead")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search staff/i), {
      target: { value: "dorm" },
    });
    expect(screen.getByText("Dorm Desk")).toBeInTheDocument();
    expect(screen.queryByText("Ops Lead")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search staff/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add staff member/i }));
    fireEvent.click(screen.getByRole("button", { name: /create staff account/i }));
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "New Staff" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "new@example.edu" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "Password1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Password1" } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0799999999" } });
    fireEvent.click(screen.getByRole("button", { name: /create staff account/i }));

    await waitFor(() =>
      expect(mocks.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.edu",
          password: "Password1",
        }),
      ),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      "profiles",
      expect.objectContaining({
        id: "new-staff-1",
        role: "staff",
        phone: "0799999999",
      }),
    );

    const firstStaffCard = screen.getByText("Ops Lead").closest(".staff-card");
    fireEvent.click(within(firstStaffCard).getByRole("button", { name: "On" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("profiles", { status: "inactive" }));

    fireEvent.click(within(firstStaffCard).getByRole("button", { name: /delete/i }));
    expect(screen.getByRole("heading", { name: /confirm deletion/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete staff member/i }));

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("profiles"));
  });
});
