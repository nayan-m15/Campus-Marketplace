import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1", email: "student@example.com" },
  role: "student",
  active: true,
  profileComplete: true,
  signOut: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  insertMessage: vi.fn(),
  toggleWishlist: vi.fn(),
  wishlistItems: [],
}));

const listing = {
  id: "listing-1",
  title: "Campus Calculator",
  description: "Graphing calculator in good shape.",
  price: "R 450",
  category: "Electronics",
  condition: "Good",
  seller: "Seller One",
  user_id: "seller-1",
  status: "active",
  image_url: "",
  image_urls: [],
  seller_is_verified: true,
  seller_verified_university: "University of Pretoria (UP)",
};

function profileRow() {
  return {
    id: mocks.user?.id || "user-1",
    name: mocks.profileComplete ? "Student User" : "",
    display_name: "Student",
    role: mocks.role,
    status: mocks.active ? "active" : "inactive",
    sex: mocks.profileComplete ? "Female" : "",
    birthdate: mocks.profileComplete ? "2001-01-01" : "",
    province: mocks.profileComplete ? "Gauteng" : "",
    institution: mocks.profileComplete ? "University of Pretoria (UP)" : "",
    is_verified: true,
    verified_university: "University of Pretoria (UP)",
  };
}

function makeQuery(table) {
  const filters = {};
  const query = {
    select: () => query,
    eq: (column, value) => {
      filters[column] = value;
      return query;
    },
    in: () => query,
    is: () => query,
    neq: () => query,
    or: () => query,
    order: () => query,
    limit: () => query,
    update: (payload) => {
      mocks.update(table, payload);
      return query;
    },
    delete: () => {
      mocks.delete(table);
      return query;
    },
    single: () => Promise.resolve({ data: table === "profiles" ? profileRow() : listing, error: null }),
    maybeSingle: () => Promise.resolve({ data: table === "listings" ? listing : null, error: null }),
    then: (resolve) => {
      if (table === "profiles") return Promise.resolve(resolve({ data: [profileRow()], error: null, count: 1 }));
      if (table === "transactions") return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
      if (table === "ratings") return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
      if (table === "messages" || table === "offers") return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
      if (table === "listings") return Promise.resolve(resolve({ data: [listing], error: null, count: 1 }));
      return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
    },
  };
  return query;
}

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    signOut: mocks.signOut,
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
    lastAuthEvent: null,
  }),
}));

vi.mock("./context/useWishlist", () => ({
  useWishlist: () => ({
    wishlistItems: mocks.wishlistItems,
    loading: false,
    isWishlisted: (id) => mocks.wishlistItems.some((item) => item.id === id),
    toggleWishlist: mocks.toggleWishlist,
  }),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => makeQuery(table),
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: () => ({ id: "channel-1" }),
      };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

vi.mock("./utils/messageDelivery", () => ({
  insertMessage: (...args) => mocks.insertMessage(...args),
}));

vi.mock("./data/listings", () => ({
  CONDITIONS: ["All Conditions", "Good", "Fair"],
  fetchListings: () => Promise.resolve([listing]),
}));

vi.mock("./components/NavBar", () => ({
  default: (props) => (
    <nav aria-label="mock nav">
      <button onClick={props.onHome}>Home</button>
      <button onClick={props.onShowListingForm}>List Item</button>
      <button onClick={props.onProfile}>Profile</button>
      <button onClick={props.onMessages}>Messages</button>
      <button onClick={props.onYourListings}>Your Listings</button>
      <button onClick={props.onBookings}>Bookings</button>
      <button onClick={props.onWishlist}>Wishlist {props.wishlistCount}</button>
      <button onClick={props.onSettings}>Settings</button>
      <button onClick={props.onAdminDashboard}>Admin</button>
      <button onClick={props.onSignOut}>Sign Out</button>
      <input aria-label="Nav search" onChange={(event) => props.onSearchChange(event.target.value)} onFocus={props.onSearchFocus} />
    </nav>
  ),
}));

vi.mock("./components/Hero", () => ({
  default: (props) => (
    <section aria-label="mock hero">
      <button onClick={props.onBrowseClick}>Browse</button>
      <button onClick={props.onHowItWorksClick}>How It Works</button>
      <button onClick={props.onSignupClick}>Hero Signup</button>
      <button onClick={props.onLoginClick}>Hero Login</button>
    </section>
  ),
}));

vi.mock("./components/FilterBar.jsx", () => ({
  default: (props) => (
    <section aria-label="mock filters">
      <button onClick={() => props.onCategoryChange("Electronics")}>Electronics</button>
      <button onClick={() => props.onConditionChange("Good")}>Good condition</button>
      <button onClick={() => props.onPriceSortChange("custom")}>Custom price</button>
      <button onClick={() => props.onPriceRangeChange({ min: "100", max: "900" })}>Range</button>
    </section>
  ),
}));

vi.mock("./components/ListingsGrid", () => ({
  default: (props) => (
    <section aria-label="mock listings">
      <p>Listings {props.listings.length}</p>
      <button onClick={() => props.onListingClick(listing)}>Open Listing</button>
      <button onClick={() => props.onMessageSeller(listing)}>Message Seller</button>
      <button onClick={() => props.onSellerClick("seller-1", "Seller One")}>Seller Profile</button>
      {props.onModerateListing && <button onClick={() => props.onModerateListing({ ...listing, status: "flagged", flag_reason: "Needs review" })}>Moderate</button>}
      {props.onToggleWishlist && <button onClick={() => props.onToggleWishlist(listing.id)}>Toggle Save</button>}
    </section>
  ),
}));

vi.mock("./components/ListingForm", () => ({
  default: (props) => (
    <section aria-label="mock listing form">
      <button onClick={props.onSuccess}>Create Listing</button>
      <button onClick={props.onCancel}>Cancel Listing</button>
    </section>
  ),
}));

vi.mock("./components/LoginPage", () => ({ default: ({ onNavigate }) => <button onClick={() => onNavigate("signup")}>Login Page</button> }));
vi.mock("./components/SignupPage", () => ({ default: ({ onNavigate }) => <button onClick={() => onNavigate("login")}>Signup Page</button> }));
vi.mock("./components/ResetPasswordPage", () => ({ default: ({ onComplete }) => <button onClick={onComplete}>Reset Password</button> }));
vi.mock("./components/ProfileSetupPage", () => ({ default: ({ onComplete }) => <button onClick={onComplete}>Profile Setup</button> }));
vi.mock("./components/HowItWorksPage", () => ({ default: ({ onBack }) => <button onClick={onBack}>How It Works Page</button> }));
vi.mock("./components/Footer", () => ({ default: () => <p>Footer</p> }));
vi.mock("./components/VerifiedBadge", () => ({ default: () => <span>Verified</span> }));
vi.mock("./components/UnverifiedSellerWarning", () => ({ default: ({ onCancel, onContinue }) => <section><button onClick={onCancel}>Cancel warning</button><button onClick={onContinue}>Continue warning</button></section> }));
vi.mock("./components/RatingPromptModal", () => ({ default: ({ onDone }) => <button onClick={() => onDone("txn-1", true)}>Rating Prompt</button> }));

vi.mock("./components/ProfilePage", () => ({
  default: (props) => (
    <section>
      <h1>Profile Page</h1>
      <button onClick={() => props.onBack()}>Back Profile</button>
      <button onClick={() => props.onNameChange("New Name")}>Name Change</button>
      <button onClick={() => props.onAvatarChange("avatar.png")}>Avatar Change</button>
    </section>
  ),
}));

vi.mock("./components/PublicProfilePage", () => ({
  default: (props) => (
    <section>
      <h1>Public Profile Page</h1>
      <button onClick={props.onBack}>Back Public</button>
      <button onClick={() => props.onMessageSeller("seller-1")}>Message Public Seller</button>
    </section>
  ),
}));

vi.mock("./components/MessagesPage", () => ({
  default: (props) => (
    <section>
      <h1>Messages Page</h1>
      <button onClick={props.onBack}>Back Messages</button>
      <button onClick={() => props.onViewProfile("seller-1")}>View Profile</button>
      <button onClick={props.onGoToBookings}>Go Bookings</button>
      <button onClick={() => props.onUnreadChange(3)}>Unread Change</button>
    </section>
  ),
}));

vi.mock("./components/YourListingsPage", () => ({
  default: (props) => (
    <section>
      <h1>Your Listings Page</h1>
      <button onClick={props.onBack}>Back Listings</button>
      <button onClick={props.onListingChanged}>Listing Changed</button>
    </section>
  ),
}));

vi.mock("./components/BookingsUi", () => ({
  StudentBookingsPage: (props) => (
    <section>
      <h1>Bookings Page</h1>
      <button onClick={props.onBack}>Back Bookings</button>
    </section>
  ),
}));

vi.mock("./components/WishlistPage", () => ({
  default: (props) => (
    <section>
      <h1>Wishlist Page</h1>
      <button onClick={() => props.onListingClick(mocks.wishlistItems[0] || listing)}>Open Wishlist Listing</button>
      <button onClick={() => props.onToggleWishlist(listing.id)}>Toggle Wishlist Page</button>
    </section>
  ),
}));

vi.mock("./components/SettingsPage", () => ({
  default: (props) => (
    <section>
      <h1>Settings Page</h1>
      <button onClick={props.onBack}>Back Settings</button>
      <button onClick={props.onSignOut}>Settings Sign Out</button>
      <button onClick={props.onAccountDeleted}>Account Deleted</button>
    </section>
  ),
}));

vi.mock("./components/AdminDashboard.jsx", () => ({
  default: (props) => (
    <section>
      <h1>Admin Page</h1>
      <button onClick={props.onOpenSettings}>Admin Settings</button>
      <button onClick={props.onBackToMarketplace}>Admin Back</button>
      <button onClick={() => props.onModerateListing({ ...listing, status: "active", flag_reason: "" })}>Admin Moderate</button>
      <button onClick={props.onSignOut}>Admin Sign Out</button>
    </section>
  ),
}));

vi.mock("./components/TradeFacilityDashboard", () => ({
  default: ({ onSignOut }) => (
    <section>
      <h1>Staff Dashboard</h1>
      <button onClick={onSignOut}>Staff Sign Out</button>
    </section>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "user-1", email: "student@example.com" };
  mocks.role = "student";
  mocks.active = true;
  mocks.profileComplete = true;
  mocks.wishlistItems = [{ ...listing, id: "wishlist-1", title: "Saved Calculator" }];
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.insertMessage.mockResolvedValue({ error: null });
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

async function renderReady() {
  render(<App />);
  await screen.findByRole("navigation", { name: /mock nav/i });
}

describe("App route coverage", () => {
  test("navigates through protected student pages and child callbacks", async () => {
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /list item/i }));
    expect(screen.getByLabelText(/mock listing form/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /create listing/i }));
    await waitFor(() => expect(screen.queryByLabelText(/mock listing form/i)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
    expect(await screen.findByRole("heading", { name: /profile page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /name change/i }));
    fireEvent.click(screen.getByRole("button", { name: /avatar change/i }));
    fireEvent.click(screen.getByRole("button", { name: /back profile/i }));

    fireEvent.click(await screen.findByRole("button", { name: /messages/i }));
    expect(await screen.findByRole("heading", { name: /messages page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view profile/i }));
    expect(await screen.findByRole("heading", { name: /public profile page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /message public seller/i }));
    expect(await screen.findByRole("heading", { name: /messages page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /go bookings/i }));
    expect(await screen.findByRole("heading", { name: /bookings page/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /your listings/i }));
    expect(await screen.findByRole("heading", { name: /your listings page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /listing changed/i }));

    fireEvent.click(screen.getByRole("button", { name: /wishlist/i }));
    expect(await screen.findByRole("heading", { name: /wishlist page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /toggle wishlist page/i }));
    expect(mocks.toggleWishlist).toHaveBeenCalledWith("listing-1");
    fireEvent.click(screen.getByRole("button", { name: /open wishlist listing/i }));
    expect(await screen.findByRole("button", { name: /close item details/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(await screen.findByRole("heading", { name: /settings page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back settings/i }));
    expect(await screen.findByLabelText(/mock hero/i)).toBeInTheDocument();
  });

  test("covers home listing actions, warnings, filters, and auth sign out", async () => {
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /electronics/i }));
    fireEvent.click(screen.getByRole("button", { name: /good condition/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom price/i }));
    fireEvent.click(screen.getByRole("button", { name: /^range$/i }));
    fireEvent.change(screen.getByLabelText(/nav search/i), { target: { value: "calculator" } });

    fireEvent.click(screen.getByRole("button", { name: /open listing/i }));
    expect(await screen.findByRole("button", { name: /add to wishlist/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add to wishlist/i }));
    expect(mocks.toggleWishlist).toHaveBeenCalledWith("listing-1");
    fireEvent.click(screen.getByRole("button", { name: /close item details/i }));

    fireEvent.click(screen.getByRole("button", { name: /message seller/i }));
    expect(await screen.findByRole("heading", { name: /messages page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back messages/i }));

    fireEvent.click(await screen.findByRole("button", { name: /seller profile/i }));
    expect(await screen.findByRole("heading", { name: /public profile page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back public/i }));

    fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  });

  test("renders admin moderation and settings flows", async () => {
    mocks.role = "admin";
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /^admin$/i }));
    expect(await screen.findByRole("heading", { name: /admin page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /admin moderate/i }));
    expect(await screen.findByRole("heading", { name: /review moderation/i })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/explain why this listing is being flagged/i), { target: { value: "Unsafe payment instructions." } });
    fireEvent.click(screen.getByRole("button", { name: /flag listing/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("listings", expect.objectContaining({ status: "flagged" })));
    fireEvent.click(screen.getByRole("button", { name: /unflag listing/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("listings", expect.objectContaining({ status: "active" })));

    fireEvent.click(screen.getByRole("button", { name: /close moderation panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /admin settings/i }));
    expect(await screen.findByRole("heading", { name: /settings page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /account deleted/i }));
    expect(await screen.findByLabelText(/mock hero/i)).toBeInTheDocument();
  });

  test("routes incomplete profiles to setup and staff users to staff dashboard", async () => {
    mocks.profileComplete = false;
    render(<App />);
    expect(await screen.findByRole("button", { name: /profile setup/i })).toBeInTheDocument();

    cleanup();
    mocks.profileComplete = true;
    mocks.role = "staff";
    render(<App />);
    expect(await screen.findByRole("heading", { name: /staff dashboard/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /staff sign out/i }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  });

  test("redirects logged-out protected routes to login and supports auth page navigation", async () => {
    mocks.user = null;
    window.history.replaceState({}, "", "/wishlist");
    render(<App />);

    expect(await screen.findByRole("button", { name: /login page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /login page/i }));
    expect(await screen.findByRole("button", { name: /signup page/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /signup page/i }));
    expect(await screen.findByRole("button", { name: /login page/i })).toBeInTheDocument();
  });
});
