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
  image_url: "",
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
    return { data: [sellerProfile, buyerProfile].filter((entry) => !ids || ids.includes(entry.id)), error: null };
  }
  if (table === "messages") return { data: messages, error: null };
  if (table === "ratings") return { data: [{ listing_id: "listing-2", rating: 4 }], error: null };
  if (table === "listings" && mode === "rateable") return { data: [{ id: "listing-2", title: "Textbook" }], error: null };
  if (table === "listings" && mode === "single") {
    return { data: filters.id === "listing-2" ? { id: "listing-2", title: "Textbook", price: 500 } : userListing, error: null };
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
            { day: "Mon", open: true, start_time: "09:00", end_time: "17:00" },
          ],
        },
      ],
      error: null,
    };
  }
  return { data: [], error: null };
}

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
    not: () => query,
    or: () => query,
    order: () => query,
    in: (column, values) => {
      filters[column] = values;
      return table === "listings" ? makeQuery(table, "rateable", filters) : query;
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
      return Promise.resolve({ data: null, error: null });
    },
    upsert: (payload, options) => {
      mocks.upsert(table, payload, options);
      return Promise.resolve({ data: null, error: null });
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
        distance: "0 km",
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
        distance: "1 km",
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

  render(<ProfilePage onBack={onBack} onNameChange={onNameChange} />);

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
  const onView = render(
    <PublicProfilePage
      userId="seller-1"
      onBack={onBack}
      onMessageSeller={onMessageSeller}
    />
  );

  expect(await screen.findByRole("heading", { name: /seller/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /message/i }));
  expect(onMessageSeller).toHaveBeenCalled();

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "listing-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: /rate 5 stars/i }));
  fireEvent.click(screen.getByRole("button", { name: /submit rating/i }));

  await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(
    "ratings",
    expect.objectContaining({
      rater_id: "user-1",
      rated_id: "seller-1",
      listing_id: "listing-2",
      rating: 5,
    }),
    { onConflict: "rater_id,listing_id" }
  ));

  onView.unmount();
});

test("YourListingsPage edits status and deletes a listing", async () => {
  const onBack = vi.fn();
  const onListingChanged = vi.fn();
  render(<YourListingsPage onBack={onBack} onListingChanged={onListingChanged} />);

  expect(await screen.findByRole("heading", { name: /your listings/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /back/i }));
  expect(onBack).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /mark sold/i }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("listings", { status: "sold" }));

  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Desk Lamp Pro" } });
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
          payload?.price === 300.75
      )
    ).toBe(true)
  );

  fireEvent.click(screen.getByRole("button", { name: /🗑|delete/i }));
  fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }));

  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("listings"));
  expect(onListingChanged).toHaveBeenCalled();
});

test("Hero loads listings, opens help popup, and routes CTA clicks", async () => {
  const onListingClick = vi.fn();
  const onBrowseClick = vi.fn();
  const onSignupClick = vi.fn();
  const onLoginClick = vi.fn();

  render(
    <Hero
      onListingClick={onListingClick}
      onBrowseClick={onBrowseClick}
      onSignupClick={onSignupClick}
      onLoginClick={onLoginClick}
      user={null}
    />
  );

  expect(await screen.findByText("11")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /start browsing/i }));
  expect(onBrowseClick).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /how it works/i }));
  expect(await screen.findByRole("heading", { name: /how it works/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /close/i }));

  fireEvent.click((await screen.findAllByRole("button", { name: /view details/i }))[0]);
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
      onBack={onBack}
      onViewProfile={onViewProfile}
      onUnreadChange={onUnreadChange}
    />
  );

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

test("MessagesPage shows seller quick replies and sends the selected response", async () => {
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

test("AdminDashboard loads facilities, saves changes, and generates a report", async () => {
  const onSignOut = vi.fn();
  render(<AdminDashboard onSignOut={onSignOut} />);

  expect(await screen.findByText(/main trade desk/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/main trade desk/i));

  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/changes saved/i);

  fireEvent.click(screen.getByRole("button", { name: /reports/i }));
  fireEvent.click(screen.getByRole("button", { name: /generate report/i }));

  expect(await screen.findByText(/executive overview/i)).toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenCalledWith("get_executive_overview", expect.any(Object));

  fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  expect(onSignOut).toHaveBeenCalled();
});

test("TradeFacilityDashboard renders navigation and sign out", () => {
  const onSignOut = vi.fn();
  render(<TradeFacilityDashboard onSignOut={onSignOut} />);

  expect(screen.getByRole("heading", { name: /dashboard overview/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /drop-off bookings/i }));
  expect(screen.getAllByRole("heading", { name: /drop-off bookings/i }).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: /all transactions/i }));
  expect(screen.getAllByRole("heading", { name: /all transactions/i }).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
  expect(onSignOut).toHaveBeenCalled();
});
