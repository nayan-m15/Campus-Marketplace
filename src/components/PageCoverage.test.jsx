// Main structure for the page coverage test feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, expect, test } from "vitest";
import AdminDashboard from "./AdminDashboard";
import Hero from "./Hero";
import MessagesPage from "./MessagesPage";
import ProfilePage from "./ProfilePage";
import ProfileSetupPage from "./ProfileSetupPage";
import PublicProfilePage from "./PublicProfilePage";
import TradeFacilityDashboard from "./TradeFacilityDashboard";
import YourListingsPage from "./YourListingsPage";
import { StudentBookingsPage } from "./BookingsUi";
import { NotificationProvider } from "../context/NotificationContext";

function renderWithNotifications(ui) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  removeChannel: vi.fn(),
}));

const currentUser = {
  id: "user-1",
  email: "student@example.com",
  created_at: "2025-02-01T00:00:00.000Z",
};

const profile = {
  id: "user-1",
  name: "Student User",
  display_name: "Student",
  about: "I sell useful campus gear.",
  province: "Gauteng",
  institution: "University of Johannesburg (UJ)",
  birthdate: "2001-04-10",
  sex: "Prefer not to say",
  phone: "0712345678",
  avatar_url: "",
  created_at: "2025-02-01T00:00:00.000Z",
  notif_messages: true,
  notif_listing_activity: false,
  is_verified: true,
  verified_university: "University of Johannesburg (UJ)",
};

const sellerProfile = {
  id: "seller-1",
  name: "Seller Person",
  display_name: "Seller",
  about: "Reliable seller.",
  province: "Western Cape",
  institution: "University of Cape Town (UCT)",
  birthdate: "2000-01-01",
  sex: "Female",
  avatar_url: "",
  created_at: "2024-01-01T00:00:00.000Z",
  avg_rating: 4,
  rating_count: 1,
  is_verified: true,
  verified_university: "University of Cape Town (UCT)",
};

const buyerProfile = {
  id: "buyer-1",
  name: "Buyer Person",
  display_name: "Buyer",
  about: "Interested buyer.",
  province: "KwaZulu-Natal",
  institution: "University of KwaZulu-Natal (UKZN)",
  birthdate: "2002-02-02",
  sex: "Male",
  avatar_url: "",
  created_at: "2024-06-01T00:00:00.000Z",
  is_verified: true,
  verified_university: "University of KwaZulu-Natal (UKZN)",
};

const userListing = {
  id: "listing-1",
  title: "Desk Lamp",
  description: "Bright lamp",
  price: 250,
  condition: "Good",
  category: "Electronics",
  status: "active",
  user_id: "user-1",
  // Seed a real existing image so the edit-photo test covers replacement.
  image_url: "https://example.com/old-lamp.jpg",
  image_urls: ["https://example.com/old-lamp.jpg"],
  emoji: "Lamp",
  created_at: "2026-01-01T00:00:00.000Z",
};

const defaultMessages = [
  {
    id: "m1",
    created_at: new Date().toISOString(),
    sender_id: "seller-1",
    receiver_id: "user-1",
    content: "Still available",
    is_read: false,
    listing_id: "listing-2",
  },
  {
    id: "m2",
    created_at: new Date().toISOString(),
    sender_id: "user-1",
    receiver_id: "seller-1",
    content: "Great, thanks",
    is_read: true,
    listing_id: "listing-2",
  },
];
const messages = [...defaultMessages];
const defaultOffers = [];
const offers = [...defaultOffers];
const defaultTransactions = [
  {
    id: "txn-1",
    item: "Textbook",
    listing_id: "listing-2",
    seller_id: "seller-1",
    buyer_id: "user-1",
    price: 500,
    status: "awaiting_dropoff",
    dropoff_id: "booking-1",
    collection_id: null,
    created_at: "2026-04-18T10:00:00.000Z",
  },
  {
    id: "txn-2",
    item: "Ball",
    listing_id: "listing-3",
    seller_id: "seller-1",
    buyer_id: "buyer-1",
    price: 120,
    status: "completed",
    dropoff_id: null,
    collection_id: null,
    created_at: "2026-04-20T10:00:00.000Z",
  },
];
const transactions = [...defaultTransactions];
const defaultBookings = [
  {
    id: "booking-1",
    type: "dropoff",
    scheduled_time: "2026-04-19T10:00:00.000Z",
    location: "Main Trade Desk",
    created_at: "2026-04-18T10:05:00.000Z",
  },
];
const bookings = [...defaultBookings];
const defaultListingRecords = {
  "listing-1": userListing,
  "listing-2": {
    id: "listing-2",
    title: "Textbook",
    price: 500,
    user_id: "seller-1",
    status: "active",
    flag_reason: "",
  },
  "listing-3": {
    id: "listing-3",
    title: "Ball",
    price: 120,
    user_id: "seller-1",
    status: "active",
    flag_reason: "",
  },
};
const listingRecords = structuredClone(defaultListingRecords);

// Supporting logic for the result for flow is kept here.
// Breaking it out makes the file easier to scan and maintain.
function resultFor(table, mode, filters = {}) {
  if (table === "listings" && mode === "count") {
    const excludedUserId = filters.__neq?.user_id;
    return {
      data: null,
      count: excludedUserId === "user-1" ? 8 : 11,
      error: null,
    };
  }
  if (table === "profiles" && mode === "count") {
    return { data: null, count: 24, error: null };
  }
  if (table === "profiles" && mode === "single") {
    if (filters.id === "seller-1") return { data: sellerProfile, error: null };
    if (filters.id === "buyer-1") return { data: buyerProfile, error: null };
    return { data: profile, error: null };
  }
  if (table === "profiles") {
    const ids = Array.isArray(filters.id) ? filters.id : filters.id ? [filters.id] : null;
    return { data: [profile, sellerProfile, buyerProfile].filter((entry) => !ids || ids.includes(entry.id)), error: null };
  }
  if (table === "messages") return { data: messages, error: null };
  if (table === "offers" && mode === "single") {
    const row = offers.find((offer) => !filters.id || offer.id === filters.id) || null;
    return { data: row, error: null };
  }
  if (table === "offers") return { data: offers, error: null };
  if (table === "transactions" && mode === "single") {
    const row = transactions.find((transaction) => !filters.id || transaction.id === filters.id) || null;
    return { data: row, error: null };
  }
  if (table === "transactions") {
    let rows = [...transactions];
    if (filters.seller_id) rows = rows.filter((row) => row.seller_id === filters.seller_id);
    if (filters.buyer_id) rows = rows.filter((row) => row.buyer_id === filters.buyer_id);
    if (filters.item) rows = rows.filter((row) => row.item === filters.item);
    if (filters.id) {
      const ids = Array.isArray(filters.id) ? filters.id : [filters.id];
      rows = rows.filter((row) => ids.includes(row.id));
    }
    return { data: rows, error: null };
  }
  if (table === "bookings") {
    let rows = [...bookings];
    if (filters.id) {
      const ids = Array.isArray(filters.id) ? filters.id : [filters.id];
      rows = rows.filter((row) => ids.includes(row.id));
    }
    return { data: rows, error: null };
  }
  if (table === "ratings") return { data: [], error: null };
  if (table === "listings" && mode === "rateable") {
    const ids = Array.isArray(filters.id) ? filters.id : filters.id ? [filters.id] : [];
    return { data: ids.map((id) => listingRecords[id]).filter(Boolean), error: null };
  }
  if (table === "listings" && mode === "single") {
    return { data: listingRecords[filters.id] || userListing, error: null };
  }
  if (table === "listings") return { data: [userListing], error: null };
  if (table === "facilities") {
    return {
      data: [
        {
          id: "facility-1",
          name: "Main Trade Desk",
          capacity: 8,
          facility_hours: [
            { day: "Monday", open: true, start_time: "09:00", end_time: "17:00" },
            { day: "Tuesday", open: true, start_time: "09:00", end_time: "17:00" },
          ],
        },
      ],
      error: null,
    };
  }
  if (table === "facility_hours") {
    return {
      data: [
        { id: 1, facility_id: "facility-1", day: "Monday", open: true, start_time: "09:00", end_time: "17:00" },
        { id: 2, facility_id: "facility-1", day: "Tuesday", open: true, start_time: "09:00", end_time: "17:00" },
      ],
      error: null,
    };
  }
  return { data: [], error: null };
}

// Supporting logic for the make query flow is kept here.
// Breaking it out makes the file easier to scan and maintain.
function makeQuery(table, mode = "list", filters = {}) {
  const query = {
    select: (_columns, options = {}) => {
      if (options.head && options.count === "exact") {
        return makeQuery(table, "count", filters);
      }
      return query;
    },
    eq: (column, value) => {
      filters[column] = value;
      return query;
    },
    neq: (column, value) => {
      filters.__neq = {
        ...(filters.__neq || {}),
        [column]: value,
      };
      return query;
    },
    gte: () => query,
    lte: () => query,
    not: () => query,
    or: () => query,
    order: () => query,
    in: (column, values) => {
      filters[column] = values;
      return table === "listings" ? makeQuery(table, "rateable", filters) : query;
    },
    is: (column, value) => {
      filters[column] = value;
      return query;
    },
    maybeSingle: () => Promise.resolve(resultFor(table, "single", filters)),
    single: () => Promise.resolve(resultFor(table, "single", filters)),
    update: (payload) => {
      mocks.update(table, payload);
      return query;
    },
    delete: () => {
      mocks.delete(table);
      return query;
    },
    insert: (payload) => {
      mocks.insert(table, payload);
      return query;
    },
    upsert: (payload, options) => {
      mocks.upsert(table, payload, options);
      return query;
    },
    then: (resolve) => Promise.resolve(resultFor(table, mode, filters)).then(resolve),
  };
  return query;
}

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: (table) => makeQuery(table),
    rpc: (...args) => {
      mocks.rpc(...args);
      if (args[0] === "get_seller_rating") {
        return Promise.resolve({ data: [{ average: "4.5", count: "2" }], error: null });
      }
      if (args[0] === "get_public_transaction_history") {
        return Promise.resolve({
          data: [
            {
              transaction_id: "txn-2",
              item_title: "Ball",
              item_image_url: "",
              relationship_label: "Sold to",
              other_user_name: "Buyer",
              created_at: "2026-04-20T10:00:00.000Z",
            },
            {
              transaction_id: "txn-1",
              item_title: "Textbook",
              item_image_url: "",
              relationship_label: "Sold to",
              other_user_name: "Student",
              created_at: "2026-04-18T10:00:00.000Z",
            },
          ],
          error: null,
        });
      }
      if (args[0] === "book_transaction_slot") {
        const payload = args[1] || {};
        const bookingId = payload.p_booking_type === "dropoff" ? "DO-TESTBOOK" : "CL-TESTBOOK";
        return Promise.resolve({
          data: [{
            booking_id: bookingId,
            location: "Main Trade Desk",
            scheduled_time: payload.p_scheduled_time,
            booking_status: "scheduled",
            transaction_status: payload.p_booking_type === "dropoff" ? "awaiting_dropoff" : "awaiting_collection",
          }],
          error: null,
        });
      }
      if (args[0] === "book_trade_meetup_slot") {
        const payload = args[1] || {};
        return Promise.resolve({
          data: [{
            booking_id: "MT-TESTBOOK",
            location: "Main Trade Desk",
            scheduled_time: payload.p_scheduled_time,
            booking_status: "pending_approval",
            transaction_status: "awaiting_meetup",
          }],
          error: null,
        });
      }
      if (args[0] === "confirm_trade_meetup_slot" || args[0] === "decline_trade_meetup_slot") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: [{ metric: "Listings", value: 3 }], error: null });
    },
    storage: {
      from: () => ({
        upload: (...args) => {
          mocks.upload(...args);
          return Promise.resolve({ error: null });
        },
        getPublicUrl: (...args) => {
          mocks.getPublicUrl(...args);
          return { data: { publicUrl: "https://example.com/avatar.png" } };
        },
      }),
    },
    channel: () => ({
      on: () => ({
        on: () => ({
          subscribe: () => ({ id: "channel-1" }),
        }),
      }),
    }),
    removeChannel: (...args) => mocks.removeChannel(...args),
  },
}));

vi.mock("../data/listings", () => ({
  fetchListings: () =>
    Promise.resolve([
      {
        id: "hero-1",
        title: "Calculator",
        price: "R 250",
        condition: "Good",
        category: "Electronics",
        seller: "Seller",
        image_url: "",
        emoji: "Calc",
      },
      {
        id: "hero-2",
        title: "Textbook",
        price: "R 150",
        condition: "Like New",
        category: "Textbooks",
        seller: "Amina",
        image_url: "",
        emoji: "Book",
      },
    ]),
  CONDITION_COLORS: {
    New: "#1F6B52",
    "Like New": "#7D8F86",
    Good: "#E59D3A",
    Fair: "#C75B4A",
    Poor: "#A0AAA2",
  },
  CATEGORIES: [
    { label: "All Items", emoji: "All" },
    { label: "Electronics", emoji: "Laptop" },
    { label: "Textbooks", emoji: "Book" },
    { label: "Other", emoji: "Box" },
  ],
  CONDITIONS: ["All Conditions", "New", "Like New", "Good", "Fair", "Poor"],
}));

vi.mock("jspdf", () => ({
  default: vi.fn(() => ({
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
    internal: { pageSize: { height: 200, width: 200 } },
  })),
}));

vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  messages.splice(0, messages.length, ...defaultMessages);
  offers.splice(0, offers.length, ...defaultOffers);
  transactions.splice(0, transactions.length, ...defaultTransactions);
  bookings.splice(0, bookings.length, ...defaultBookings);
  Object.assign(listingRecords, structuredClone(defaultListingRecords));
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
  Element.prototype.scrollIntoView = vi.fn();
});

test("ProfileSetupPage validates steps and saves completed profile", async () => {
  const onComplete = vi.fn();
  render(<ProfileSetupPage onComplete={onComplete} />);

  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/full name/i);

  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: "Test Student" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  fireEvent.click(screen.getByRole("button", { name: /^male$/i }));
  fireEvent.change(screen.getByLabelText(/date of birth/i), {
    target: { value: "2000-05-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

  fireEvent.change(screen.getByLabelText(/province/i), { target: { value: "Gauteng" } });
  fireEvent.change(screen.getByLabelText(/university/i), {
    target: { value: "University of Johannesburg (UJ)" },
  });
  fireEvent.click(screen.getByRole("button", { name: /let's go/i }));

  await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
    "profiles",
    expect.objectContaining({
      id: "user-1",
      email: "student@example.com",
      name: "Test Student",
      display_name: "Test",
      institution: "University of Johannesburg (UJ)",
    }),
    { onConflict: "id" }
  ));
  expect(onComplete).toHaveBeenCalled();
});

test("ProfilePage loads profile, validates phone, and saves updates", async () => {
  const onBack = vi.fn();
  const onNameChange = vi.fn();

  renderWithNotifications(<ProfilePage onBack={onBack} onNameChange={onNameChange} />);

  expect(await screen.findByDisplayValue("Student User")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /back/i }));
  expect(onBack).toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "1111111111" } });
  expect(screen.getByText(/valid sa mobile/i)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Campus Seller" } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0712345678" } });
  fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

  await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
    "profiles",
    expect.objectContaining({
      email: "student@example.com",
      display_name: "Campus Seller",
      phone: "0712345678",
    }),
    { onConflict: "id" }
  ));
  expect(onNameChange).toHaveBeenCalledWith("Campus Seller");
});

test("PublicProfilePage loads seller details and submits a rating", async () => {
  const onBack = vi.fn();
  const onMessageSeller = vi.fn();
  const onView = renderWithNotifications(
    <PublicProfilePage
      userId="seller-1"
      onBack={onBack}
      onMessageSeller={onMessageSeller}
    />
  );

  expect(await screen.findByRole("heading", { name: /seller/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /message/i }));
  expect(onMessageSeller).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /transaction history/i }));
  expect(await screen.findByText(/textbook/i)).toBeInTheDocument();
  expect(screen.getByText(/sold to student/i)).toBeInTheDocument();
  expect(screen.getByText(/ball/i)).toBeInTheDocument();
  expect(screen.getByText(/sold to buyer/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^details$/i }));

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "listing-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: /rate 5 stars/i }));
  fireEvent.click(screen.getByRole("button", { name: /submit rating/i }));

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "ratings",
    expect.objectContaining({
      rater_id: "user-1",
      rated_id: "seller-1",
      listing_id: "listing-2",
      rating: 5,
    })
  ));

  onView.unmount();
});

test("YourListingsPage edits status and deletes a listing", async () => {
  const onBack = vi.fn();
  const onListingChanged = vi.fn();
  renderWithNotifications(<YourListingsPage onBack={onBack} onListingChanged={onListingChanged} />);

  expect(await screen.findByRole("heading", { name: /your listings/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /back/i }));
  expect(onBack).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  fireEvent.click(screen.getByRole("radio", { name: /for sale & trade/i }));
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Desk Lamp Pro" } });
  // Category edits should use the same Save Changes path as the other fields.
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "Textbooks" } });
  const priceInput = screen.getByLabelText(/price/i);
  fireEvent.focus(priceInput);
  fireEvent.change(priceInput, { target: { value: "300.75" } });
  expect(priceInput).toHaveValue("300.75");
  fireEvent.submit(screen.getByRole("button", { name: /save changes/i }).closest("form"));

  await waitFor(() =>
    expect(
      mocks.update.mock.calls.some(
        ([table, payload]) =>
          table === "listings" &&
          payload?.title === "Desk Lamp Pro" &&
          payload?.price === 300.75 &&
          payload?.category === "Textbooks" &&
          payload?.listing_type === "sale_and_trade" &&
          payload?.status === "active"
      )
    ).toBe(true)
  );

  fireEvent.click(screen.getByRole("button", { name: /mark sold/i }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("listings", { status: "sold" }));

  fireEvent.click(screen.getByRole("button", { name: /🗑|delete/i }));
  fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("listings", { status: "archived" }));
  expect(onListingChanged).toHaveBeenCalled();
});

test("YourListingsPage updates listing photos in the edit modal", async () => {
  const onListingChanged = vi.fn();
  renderWithNotifications(<YourListingsPage onBack={vi.fn()} onListingChanged={onListingChanged} />);

  // Open the existing listing and verify the current photo is loaded first.
  fireEvent.click(await screen.findByRole("button", { name: /edit/i }));
  expect(screen.getByAltText(/listing photo 1/i)).toHaveAttribute("src", "https://example.com/old-lamp.jpg");

  // Remove the old cover so the newly selected file becomes the saved cover.
  fireEvent.click(screen.getByRole("button", { name: /remove photo 1/i }));

  const file = new File(["new image"], "new-lamp.png", { type: "image/png" });
  const readerResult = "data:image/png;base64,bmV3LWxhbXA=";
  // Mock FileReader because jsdom does not create image previews from files.
  class MockFileReader {
    readAsDataURL() {
      this.result = readerResult;
      this.onloadend();
    }
  }
  vi.stubGlobal("FileReader", MockFileReader);

  fireEvent.change(document.querySelector('input[aria-label="Add listing photos"]'), {
    target: { files: [file] },
  });
  expect(document.querySelector('input[aria-label="Add listing photos"]')).not.toHaveAttribute("capture");
  expect(document.querySelector('input[aria-label="Take listing photo"]')).toHaveAttribute("capture", "environment");

  // Saving should upload the new file and write both cover and gallery columns.
  expect(await screen.findByAltText(/listing photo 1/i)).toHaveAttribute("src", readerResult);
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(
    expect.stringMatching(/^user-1\/.+\.png$/),
    file,
    { upsert: false }
  ));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(
    "listings",
    expect.objectContaining({
      image_url: "https://example.com/avatar.png",
      image_urls: ["https://example.com/avatar.png"],
    })
  ));
  expect(onListingChanged).toHaveBeenCalled();

  vi.unstubAllGlobals();
});

test("Hero loads listings and routes CTA clicks", async () => {
  const onListingClick = vi.fn();
  const onBrowseClick = vi.fn();
  const onHowItWorksClick = vi.fn();
  const onSignupClick = vi.fn();
  const onLoginClick = vi.fn();

  render(
    <Hero
      onListingClick={onListingClick}
      onBrowseClick={onBrowseClick}
      onHowItWorksClick={onHowItWorksClick}
      onSignupClick={onSignupClick}
      onLoginClick={onLoginClick}
      user={null}
    />
  );

  expect(await screen.findByText("11")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));
  expect(onBrowseClick).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /how it works/i }));
  expect(onHowItWorksClick).toHaveBeenCalled();

  fireEvent.click(await screen.findByRole("button", { name: /open details for calculator/i }));
  expect(onListingClick).toHaveBeenCalledWith(expect.objectContaining({ id: "hero-1" }));

  fireEvent.click(screen.getByRole("button", { name: /start listing/i }));
  expect(onSignupClick).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /already have an account/i }));
  expect(onLoginClick).toHaveBeenCalled();
});

test("Hero active listings stat excludes the signed-in user's listings", async () => {
  render(
    <Hero
      onListingClick={vi.fn()}
      onBrowseClick={vi.fn()}
      onSignupClick={vi.fn()}
      onLoginClick={vi.fn()}
      user={currentUser}
    />
  );

  expect(await screen.findByText("8")).toBeInTheDocument();
});

test("MessagesPage opens a conversation and sends a message", async () => {
  const onBack = vi.fn();
  const onViewProfile = vi.fn();
  const onUnreadChange = vi.fn();

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingTitle="Textbook"
      initialListingId="listing-2"
      onBack={onBack}
      onViewProfile={onViewProfile}
      onUnreadChange={onUnreadChange}
    />
  );

  expect(await screen.findByText(/seller's listing/i)).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /seller - textbook/i }).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /view seller/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Yes. Are you interested?" })).not.toBeInTheDocument();

  const sellerButtons = await screen.findAllByRole("button", { name: /seller/i });
  fireEvent.click(sellerButtons[1]);
  expect(onViewProfile).toHaveBeenCalledWith("seller-1");

  const composer = screen.getByPlaceholderText(/type a message/i);
  expect(composer.value).toMatch(/textbook/i);
  fireEvent.change(composer, { target: { value: "Can I collect today?" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "messages",
    expect.objectContaining({
      sender_id: "user-1",
      receiver_id: "seller-1",
      content: "Can I collect today?",
    })
  ));

  fireEvent.click(screen.getByRole("button", { name: /back/i }));
  expect(onBack).toHaveBeenCalled();
  expect(onUnreadChange).toHaveBeenCalled();
});

test("MessagesPage deletes the active chat after confirmation", async () => {
  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingTitle="Textbook"
      initialListingId="listing-2"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  expect(await screen.findByText(/seller's listing/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /delete chat/i }));
  expect(await screen.findByRole("heading", { name: /delete this chat/i })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: /delete chat/i })[1]);

  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("messages"));
  expect(mocks.delete).toHaveBeenCalledWith("offers");
  expect(await screen.findByRole("heading", { name: /your messages/i })).toBeInTheDocument();
});

test("MessagesPage creates separate threads for different listings from the same seller", async () => {
  messages.splice(
    0,
    messages.length,
    {
      id: "m-listing-2",
      created_at: new Date("2026-04-18T08:00:00.000Z").toISOString(),
      sender_id: "seller-1",
      receiver_id: "user-1",
      content: "Textbook is still available",
      is_read: false,
      listing_id: "listing-2",
    },
    {
      id: "m-listing-3",
      created_at: new Date("2026-04-18T09:00:00.000Z").toISOString(),
      sender_id: "seller-1",
      receiver_id: "user-1",
      content: "Ball is still available",
      is_read: false,
      listing_id: "listing-3",
    }
  );

  render(
    <MessagesPage
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  expect(await screen.findByRole("button", { name: /seller - textbook/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /seller - ball/i })).toBeInTheDocument();
});

test("MessagesPage keeps offer-only threads tied to a specific listing", async () => {
  messages.splice(0, messages.length);
  offers.splice(
    0,
    offers.length,
    {
      id: "offer-1",
      created_at: new Date("2026-04-18T10:00:00.000Z").toISOString(),
      sender_id: "user-1",
      receiver_id: "seller-1",
      listing_id: "listing-3",
      amount: 5000,
      status: "accepted",
    }
  );

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingId="listing-3"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  expect((await screen.findAllByRole("button", { name: /seller - ball/i })).length).toBeGreaterThan(0);
  expect(screen.getByText(/seller's listing/i)).toBeInTheDocument();
  expect(screen.getAllByText(/ball/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/offer accepted/i).length).toBeGreaterThan(0);
});

test("MessagesPage sends a custom trade offer from the listing shortcut modal", async () => {
  messages.splice(0, messages.length);
  offers.splice(0, offers.length);
  listingRecords["listing-3"] = {
    ...listingRecords["listing-3"],
    listing_type: "trade",
  };

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingId="listing-3"
      initialListingTitle="Ball"
      initialDraft={'Hello, I\'d like to send an item trade offer for "Ball".'}
      initialAction="offer"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  expect(await screen.findByRole("heading", { name: /send an offer/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /another item/i }));
  fireEvent.change(screen.getByPlaceholderText(/item title/i), { target: { value: "Wireless Mouse" } });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Good" } });
  fireEvent.change(screen.getByPlaceholderText(/describe the item/i), { target: { value: "Works well and includes batteries." } });
  fireEvent.change(screen.getByLabelText(/attach a photo/i), {
    target: {
      files: [new File(["mouse"], "mouse.jpg", { type: "image/jpeg" })],
    },
  });

  const sendOfferButtons = screen.getAllByRole("button", { name: /send offer/i });
  fireEvent.click(sendOfferButtons[sendOfferButtons.length - 1]);

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "offers",
    expect.objectContaining({
      listing_id: "listing-3",
      requested_listing_id: "listing-3",
      offered_listing_id: null,
      offer_type: "item_trade",
      offered_item_title: "Wireless Mouse",
      offered_item_condition: "Good",
    })
  ));
});

test("MessagesPage prepares a PayFast payment transaction when a cash offer is accepted", async () => {
  transactions.splice(0, transactions.length);
  offers.splice(
    0,
    offers.length,
    {
      id: "offer-pending-1",
      created_at: new Date("2026-04-18T10:00:00.000Z").toISOString(),
      sender_id: "seller-1",
      receiver_id: "user-1",
      listing_id: "listing-2",
      amount: 500,
      status: "pending",
    }
  );

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingId="listing-2"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  fireEvent.click(await screen.findByRole("button", { name: /accept/i }));

  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "accept_cash_offer_for_payment",
    { p_offer_id: "offer-pending-1" }
  ));
});

test("MessagesPage creates an item-trade transaction when a trade offer is accepted", async () => {
  transactions.splice(0, transactions.length);
  offers.splice(
    0,
    offers.length,
    {
      id: "offer-trade-1",
      created_at: new Date("2026-04-18T10:00:00.000Z").toISOString(),
      sender_id: "seller-1",
      receiver_id: "user-1",
      listing_id: "listing-1",
      requested_listing_id: "listing-1",
      offered_listing_id: "listing-3",
      offer_type: "item_trade",
      amount: null,
      status: "pending",
    }
  );

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingId="listing-1"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  fireEvent.click(await screen.findByRole("button", { name: /accept/i }));

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "transactions",
    expect.objectContaining({
      item: "Desk Lamp for Ball",
      requested_item: "Desk Lamp",
      offered_item: "Ball",
      requested_listing_id: "listing-1",
      offered_listing_id: "listing-3",
      transaction_type: "item_trade",
      price: 0,
      status: "awaiting_meetup",
    })
  ));

  expect(mocks.update).toHaveBeenCalledWith(
    "listings",
    expect.objectContaining({ status: "sold", sold_price: null })
  );
});

test("MessagesPage shows seller quick replies and sends the selected response", async () => {
  listingRecords["listing-2"] = {
    ...listingRecords["listing-2"],
    user_id: "user-1",
    title: "Desk Lamp",
  };
  messages.splice(
    0,
    messages.length,
    {
      id: "m-buyer-1",
      created_at: new Date().toISOString(),
      sender_id: "buyer-1",
      receiver_id: "user-1",
      content: "Is this still available?",
      is_read: false,
      listing_id: "listing-2",
    }
  );

  render(
    <MessagesPage
      initialRecipientId="buyer-1"
      initialListingId="listing-2"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  expect(await screen.findByRole("button", { name: "Yes. Are you interested?" })).toBeInTheDocument();
  expect(screen.getByText(/your listing/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /view buyer/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "In talks. I'll let you know." })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sorry, it's not available." })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Yes. Are you interested?" }));

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "messages",
    expect.objectContaining({
      sender_id: "user-1",
      receiver_id: "buyer-1",
      content: "Yes. Are you interested?",
      listing_id: "listing-2",
    })
  ));
});

test("MessagesPage warns before sending a message for a flagged listing", async () => {
  listingRecords["listing-2"] = {
    ...listingRecords["listing-2"],
    status: "flagged",
    flag_reason: "Reported for suspicious payment requests.",
  };

  render(
    <MessagesPage
      initialRecipientId="seller-1"
      initialListingId="listing-2"
      onBack={vi.fn()}
      onViewProfile={vi.fn()}
      onUnreadChange={vi.fn()}
    />
  );

  const composer = await screen.findByPlaceholderText(/type a message/i);
  fireEvent.change(composer, { target: { value: "Can I collect today?" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByRole("heading", { name: /flagged listing warning/i })).toBeInTheDocument();
  expect(screen.getByText(/reported for suspicious payment requests\./i)).toBeInTheDocument();
  expect(mocks.insert).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(
    "messages",
    expect.objectContaining({
      sender_id: "user-1",
      receiver_id: "seller-1",
      content: "Can I collect today?",
      listing_id: "listing-2",
    })
  ));
});

test("AdminDashboard loads facilities, saves changes, and generates a report", async () => {
  const onSignOut = vi.fn();
  renderWithNotifications(<AdminDashboard onSignOut={onSignOut} />);

  expect(await screen.findByText(/main trade desk/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  fireEvent.click(screen.getByRole("button", { name: /update facility/i }));
  await waitFor(() =>
    expect(
      mocks.update.mock.calls.some(
        ([table, payload]) => table === "facilities" && payload?.name === "Main Trade Desk"
      )
    ).toBe(true)
  );

  fireEvent.click(screen.getByRole("button", { name: /reports/i }));
  fireEvent.click(screen.getByRole("button", { name: /generate report/i }));

  expect(await screen.findByText(/executive overview/i)).toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenCalledWith("get_executive_overview", expect.any(Object));

  fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  expect(onSignOut).toHaveBeenCalled();
});

test("TradeFacilityDashboard renders navigation and sign out", () => {
  const onSignOut = vi.fn();
  renderWithNotifications(<TradeFacilityDashboard onSignOut={onSignOut} staffProfile={profile} />);

  expect(screen.getByRole("heading", { name: /dashboard overview/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /drop-off bookings/i }));
  expect(screen.getByRole("heading", { name: /drop-off bookings/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /transaction ledger/i }));
  expect(screen.getByRole("heading", { name: /transaction ledger/i, level: 1 })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  expect(onSignOut).toHaveBeenCalled();
});

test("StudentBookingsPage shows a seller drop-off booking action for accepted trades", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-2",
      item: "Desk Lamp",
      seller_id: "user-1",
      buyer_id: "buyer-1",
      price: 250,
      status: "awaiting_dropoff",
      dropoff_id: null,
      collection_id: null,
      created_at: "2026-04-18T10:00:00.000Z",
    }
  );

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  expect(await screen.findByText(/my bookings/i)).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /book drop-off/i })).toBeInTheDocument();
});

test("StudentBookingsPage lets a buyer book collection after staff confirms drop-off", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-3",
      item: "Desk Lamp",
      seller_id: "seller-1",
      buyer_id: "user-1",
      price: 250,
      status: "item_received",
      dropoff_id: "booking-1",
      collection_id: null,
      created_at: "2026-04-18T10:00:00.000Z",
    }
  );

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  expect(await screen.findByText(/my bookings/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /book collection/i })).toBeInTheDocument();
});

test("StudentBookingsPage lets a seller complete a drop-off booking flow", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-4",
      item: "Desk Lamp",
      seller_id: "user-1",
      buyer_id: "buyer-1",
      price: 250,
      status: "awaiting_dropoff",
      dropoff_id: null,
      collection_id: null,
      created_at: "2026-05-03T10:00:00.000Z",
    }
  );
  bookings.splice(0, bookings.length);

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: /book drop-off/i }));
  const facilitySelect = await screen.findByLabelText(/^facility$/i);
  await waitFor(() => expect(facilitySelect).not.toBeDisabled());
  await waitFor(() => expect(screen.getByRole("option", { name: /main trade desk/i })).toBeInTheDocument());
  fireEvent.change(facilitySelect, { target: { value: "facility-1" } });
  const dateInput = await screen.findByLabelText(/^date$/i);
  fireEvent.change(dateInput, { target: { value: "2099-05-04" } });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.click(await screen.findByRole("button", { name: /09:00/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm slot/i }));

  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "book_transaction_slot",
    expect.objectContaining({
      p_transaction_id: "txn-4",
      p_booking_type: "dropoff",
      p_facility_id: "facility-1",
      p_scheduled_time: "2099-05-04T09:00:00",
    })
  ));
});

test("StudentBookingsPage lets a buyer complete a collection booking flow", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-5",
      item: "Desk Lamp",
      seller_id: "seller-1",
      buyer_id: "user-1",
      price: 250,
      status: "item_received",
      dropoff_id: "booking-1",
      collection_id: null,
      created_at: "2026-05-03T10:00:00.000Z",
    }
  );

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: /book collection/i }));
  await waitFor(() => {
    expect(screen.queryByRole("combobox", { name: /facility/i })).not.toBeInTheDocument();
  });
  fireEvent.change(await screen.findByLabelText(/^date$/i), { target: { value: "2099-05-04" } });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.click(await screen.findByRole("button", { name: /09:00/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm slot/i }));

  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "book_transaction_slot",
    expect.objectContaining({
      p_transaction_id: "txn-5",
      p_booking_type: "collection",
      p_facility_id: "facility-1",
      p_scheduled_time: "2099-05-04T09:00:00",
    })
  ));
});

test("StudentBookingsPage lets either trade party propose one shared swap meetup slot", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-trade-1",
      item: "Desk Lamp for Ball",
      requested_item: "Desk Lamp",
      offered_item: "Ball",
      seller_id: "seller-1",
      buyer_id: "user-1",
      price: 0,
      status: "awaiting_meetup",
      transaction_type: "item_trade",
      dropoff_id: null,
      collection_id: null,
      trade_meetup_id: null,
      trade_meetup_proposed_by: null,
      created_at: "2026-05-03T10:00:00.000Z",
    }
  );
  bookings.splice(0, bookings.length);

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: /propose swap meetup/i }));
  const facilitySelect = await screen.findByLabelText(/^facility$/i);
  await waitFor(() => expect(facilitySelect).not.toBeDisabled());
  await waitFor(() => expect(screen.getByRole("option", { name: /main trade desk/i })).toBeInTheDocument());
  fireEvent.change(facilitySelect, { target: { value: "facility-1" } });
  fireEvent.change(await screen.findByLabelText(/^date$/i), { target: { value: "2099-05-04" } });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  fireEvent.click(await screen.findByRole("button", { name: /09:00/i }));
  fireEvent.click(screen.getByRole("button", { name: /confirm slot/i }));

  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "book_trade_meetup_slot",
    expect.objectContaining({
      p_transaction_id: "txn-trade-1",
      p_facility_id: "facility-1",
      p_scheduled_time: "2099-05-04T09:00:00",
    })
  ));
});

test("StudentBookingsPage lets the other trade party accept or request a different swap meetup slot", async () => {
  transactions.splice(
    0,
    transactions.length,
    {
      id: "txn-trade-2",
      item: "Desk Lamp for Ball",
      requested_item: "Desk Lamp",
      offered_item: "Ball",
      seller_id: "seller-1",
      buyer_id: "user-1",
      price: 0,
      status: "awaiting_meetup",
      transaction_type: "item_trade",
      dropoff_id: null,
      collection_id: null,
      trade_meetup_id: "booking-meetup-1",
      trade_meetup_proposed_by: "seller-1",
      created_at: "2026-05-03T10:00:00.000Z",
    }
  );
  bookings.splice(
    0,
    bookings.length,
    {
      id: "booking-meetup-1",
      type: "trade_meetup",
      scheduled_time: "2099-05-04T09:00:00.000Z",
      location: "Main Trade Desk",
      status: "pending_approval",
      created_at: "2026-05-03T10:05:00.000Z",
    }
  );

  render(<StudentBookingsPage user={currentUser} onBack={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: /accept slot/i }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "confirm_trade_meetup_slot",
    { p_transaction_id: "txn-trade-2" }
  ));

  fireEvent.click(await screen.findByRole("button", { name: /request different slot/i }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
    "decline_trade_meetup_slot",
    { p_transaction_id: "txn-trade-2" }
  ));
});
