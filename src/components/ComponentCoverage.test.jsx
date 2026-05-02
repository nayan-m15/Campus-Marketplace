// Main structure for the component coverage test feature lives here.
// Shared UI pieces and page-level behavior are tied together in this file.

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, beforeEach, afterEach, expect, test } from "vitest";
import Footer from "./Footer";
import FilterBar from "./FilterBar";
import ListingCard from "./ListingCard";
import ListingsGrid from "./ListingsGrid";
import LoginPage from "./LoginPage";
import Navbar from "./NavBar";
import SettingsPage from "./SettingsPage";
import SignupPage from "./SignupPage";
import WishlistPage from "./WishlistPage";
import ListingForm from "./ListingForm";

const authFns = {
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  clearPasswordRecovery: vi.fn(),
};

const updateUser = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
const profileEq = vi.fn();
const profileUpdateEq = vi.fn();
const upload = vi.fn();
const getPublicUrl = vi.fn();
const insert = vi.fn();
const getUser = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "student@example.com" },
    isPasswordRecovery: false,
    ...authFns,
  }),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: (...args) => getUser(...args),
      updateUser: (...args) => updateUser(...args),
      signOut: (...args) => signOut(...args),
    },
    from: (table) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (...args) => {
              profileEq(...args);
              return {
                single: () =>
                  Promise.resolve({
                    data: {
                      notif_messages: false,
                      notif_listing_activity: true,
                    },
                    error: null,
                  }),
              };
            },
          }),
          update: (payload) => {
            profileUpdateEq(payload);
            return { eq: profileUpdateEq };
          },
        };
      }

      if (table === "listings") {
        return {
          insert: (...args) => insert(...args),
        };
      }

      return {};
    },
    storage: {
      from: () => ({
        upload: (...args) => upload(...args),
        getPublicUrl: (...args) => getPublicUrl(...args),
      }),
    },
    rpc: (...args) => rpc(...args),
  },
}));

vi.mock("../data/listings", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    CATEGORIES: [
      { label: "All Items", emoji: "All" },
      { label: "Electronics", emoji: "Laptop" },
      { label: "Other", emoji: "Box" },
    ],
    CONDITIONS: ["All Conditions", "New", "Like New", "Good", "Fair", "Poor"],
  };
});

const listing = {
  id: "listing-1",
  title: "Desk Lamp",
  price: "R 250",
  pricePrefix: "Only",
  originalPrice: "R 300",
  condition: "Good",
  category: "Electronics",
  seller: "Amina",
  user_id: "seller-1",
  institution: "UCT",
  image_url: "",
  emoji: "Lamp",
};

beforeEach(() => {
  vi.clearAllMocks();
  authFns.signIn.mockResolvedValue({ error: null });
  authFns.signUp.mockResolvedValue({ data: {}, error: null });
  authFns.signInWithGoogle.mockResolvedValue({ error: null });
  authFns.resetPassword.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({});
  rpc.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  upload.mockResolvedValue({ error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/lamp.jpg" } });
  insert.mockResolvedValue({ error: null });
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

test("renders footer brand copy", () => {
  render(<Footer />);
  expect(screen.getByText(/campusxchange/i)).toBeInTheDocument();
  expect(screen.getByText(/student marketplace/i)).toBeInTheDocument();
});

test("FilterBar fires callbacks for filter changes and clearing", () => {
  const onCategoryChange = vi.fn();
  const onConditionChange = vi.fn();
  const onPriceSortChange = vi.fn();
  const onPriceRangeChange = vi.fn();

  render(
    <FilterBar
      activeCategory="Electronics"
      onCategoryChange={onCategoryChange}
      activeCondition="Good"
      onConditionChange={onConditionChange}
      priceSort="custom"
      onPriceSortChange={onPriceSortChange}
      priceRange={{ min: "100", max: "500" }}
      onPriceRangeChange={onPriceRangeChange}
    />
  );

  fireEvent.change(screen.getByLabelText(/minimum price/i), { target: { value: "150" } });
  expect(onPriceRangeChange).toHaveBeenCalledWith({ min: "150", max: "500" });

  fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
  expect(onCategoryChange).toHaveBeenCalledWith("All Items");
  expect(onConditionChange).toHaveBeenCalledWith("All Conditions");
  expect(onPriceSortChange).toHaveBeenCalledWith("");
  expect(onPriceRangeChange).toHaveBeenCalledWith({ min: "", max: "" });
});

test("FilterBar opens separate mobile filter and sort panels", () => {
  const onCategoryChange = vi.fn();
  const onConditionChange = vi.fn();
  const onPriceSortChange = vi.fn();
  const onPriceRangeChange = vi.fn();

  render(
    <FilterBar
      activeCategory="All Items"
      onCategoryChange={onCategoryChange}
      activeCondition="All Conditions"
      onConditionChange={onConditionChange}
      priceSort=""
      onPriceSortChange={onPriceSortChange}
      priceRange={{ min: "", max: "" }}
      onPriceRangeChange={onPriceRangeChange}
      showSorting={false}
      mobileSorting
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /filter/i }));
  const filterPanel = screen.getByRole("region", { name: /filter listings panel/i });
  expect(within(filterPanel).getByRole("heading", { name: /^filter$/i })).toBeInTheDocument();

  fireEvent.change(within(filterPanel).getByLabelText(/^category$/i), {
    target: { value: "Electronics" },
  });
  expect(onCategoryChange).toHaveBeenCalledWith("Electronics");

  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
  fireEvent.click(screen.getByRole("button", { name: /sort by/i }));
  const sortPanel = screen.getByRole("region", { name: /sort listings panel/i });
  expect(within(sortPanel).getByRole("heading", { name: /sort by/i })).toBeInTheDocument();

  fireEvent.click(within(sortPanel).getByRole("button", { name: /price high to low/i }));
  expect(onPriceSortChange).toHaveBeenCalledWith("price_desc");
});

test("ListingCard supports keyboard open, seller navigation, messaging, and wishlist toggles", () => {
  const onClick = vi.fn();
  const onSellerClick = vi.fn();
  const onMessageSeller = vi.fn();
  const onToggleWishlist = vi.fn();

  render(
    <ListingCard
      item={listing}
      onClick={onClick}
      onSellerClick={onSellerClick}
      onMessageSeller={onMessageSeller}
      onToggleWishlist={onToggleWishlist}
      isWishlisted
      user={{ id: "user-1" }}
    />
  );

  const card = screen.getByRole("button", { name: /open details for desk lamp/i });
  fireEvent.keyDown(card, { key: "Enter" });
  expect(onClick).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /view profile of amina/i }));
  expect(onSellerClick).toHaveBeenCalledWith("seller-1", "Amina");

  fireEvent.click(screen.getByRole("button", { name: /message amina/i }));
  expect(onMessageSeller).toHaveBeenCalledWith(listing);

  fireEvent.click(screen.getByRole("button", { name: /remove from wishlist/i }));
  expect(onToggleWishlist).toHaveBeenCalledWith("listing-1");
});

test("ListingsGrid renders empty state and forwards listing clicks", () => {
  const onListingClick = vi.fn();
  const { rerender } = render(<ListingsGrid listings={[]} searchQuery="lamp" />);

  expect(screen.getByRole("heading", { name: /results for "lamp"/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /no listings yet/i })).toBeInTheDocument();

  rerender(<ListingsGrid listings={[listing]} onListingClick={onListingClick} />);
  fireEvent.click(screen.getByRole("button", { name: /open details for desk lamp/i }));

  expect(onListingClick).toHaveBeenCalledWith(expect.objectContaining({ id: "listing-1" }));
});

test("WishlistPage covers loading, empty, remove, click, and keyboard activation states", () => {
  const onListingClick = vi.fn();
  const onToggleWishlist = vi.fn();
  const { rerender } = render(<WishlistPage loading />);

  expect(screen.getByText(/loading your wishlist/i)).toBeInTheDocument();

  rerender(<WishlistPage wishlistItems={[]} />);
  expect(screen.getByRole("heading", { name: /your wishlist is empty/i })).toBeInTheDocument();

  rerender(
    <WishlistPage
      wishlistItems={[listing]}
      onListingClick={onListingClick}
      onToggleWishlist={onToggleWishlist}
    />
  );

  const card = screen.getByRole("button", { name: /open desk lamp/i });
  fireEvent.keyDown(card, { key: " " });
  expect(onListingClick).toHaveBeenCalledWith(listing);

  fireEvent.click(screen.getByRole("button", { name: /remove from wishlist/i }));
  expect(onToggleWishlist).toHaveBeenCalledWith("listing-1");
});

test("Navbar opens the side menu and routes logged-in actions", () => {
  const onProfile = vi.fn();
  const onYourListings = vi.fn();
  const onWishlist = vi.fn();
  const onSettings = vi.fn();
  const onSignOut = vi.fn();

  render(
    <Navbar
      searchQuery=""
      onSearchChange={vi.fn()}
      user={{ email: "student@example.com", user_metadata: { name: "Student" } }}
      onProfile={onProfile}
      onYourListings={onYourListings}
      onWishlist={onWishlist}
      onSettings={onSettings}
      onSignOut={onSignOut}
      wishlistCount={2}
      unreadCount={101}
    />
  );

  expect(screen.getByText("99+")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

  fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));
  expect(onProfile).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  fireEvent.click(screen.getByRole("button", { name: /your listings/i }));
  expect(onYourListings).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  fireEvent.click(screen.getByRole("button", { name: /wishlist/i }));
  expect(onWishlist).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  fireEvent.click(screen.getByRole("button", { name: /settings/i }));
  expect(onSettings).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
  fireEvent.click(within(screen.getByRole("navigation", { name: /side menu/i })).getByRole("button", { name: /sign out/i }));
  expect(onSignOut).toHaveBeenCalled();
});

test("Navbar prefers the profile display name over auth metadata and email prefix", () => {
  render(
    <Navbar
      searchQuery=""
      onSearchChange={vi.fn()}
      user={{
        email: "asdf@gmail.com",
        user_metadata: { full_name: "Google Name" },
      }}
      profile={{ display_name: "CampusAlias", name: "Full Student Name" }}
    />
  );

  expect(screen.getByRole("button", { name: /campusalias/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^asdf$/i })).not.toBeInTheDocument();
});

test("Navbar falls back to the full profile name when no display name exists", () => {
  render(
    <Navbar
      searchQuery=""
      onSearchChange={vi.fn()}
      user={{ email: "asdf@gmail.com" }}
      profile={{ name: "Full Student Name" }}
    />
  );

  expect(screen.getByRole("button", { name: /full student name/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^asdf$/i })).not.toBeInTheDocument();
});

test("LoginPage submits credentials and shows provider errors", async () => {
  authFns.signIn.mockResolvedValueOnce({ error: { message: "Bad credentials" } });
  authFns.signInWithGoogle.mockResolvedValueOnce({ error: { message: "OAuth failed" } });

  render(<LoginPage onNavigate={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Bad credentials");
  expect(authFns.signIn).toHaveBeenCalledWith("student@example.com", "secret123");

  fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("OAuth failed");
});

test("LoginPage can request a password reset email", async () => {
  render(<LoginPage onNavigate={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "student@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /forgot your password/i }));
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

  await waitFor(() => {
    expect(authFns.resetPassword).toHaveBeenCalledWith("student@example.com");
  });
  expect(await screen.findByText(/password reset link sent/i)).toBeInTheDocument();
});

test("SignupPage validates passwords and shows success after signup", async () => {
  const onNavigate = vi.fn();
  render(<SignupPage onNavigate={onNavigate} />);

  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "123" } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/at least 6/i);

  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Secret123" } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different" } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);

  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "Secret123" } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));

  expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
  expect(onNavigate).toHaveBeenCalledWith("login");
});

test("SignupPage reports when an email is already registered", async () => {
  authFns.signUp.mockResolvedValueOnce({
    data: { user: { identities: [] } },
    error: null,
  });

  render(<SignupPage onNavigate={vi.fn()} />);

  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "Secret123" } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: "Secret123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/email is already registered/i);
});

test("SettingsPage updates password, preferences, theme, and delete confirmation", async () => {
  const onBack = vi.fn();
  const onSignOut = vi.fn();
  const onAccountDeleted = vi.fn();

  render(
    <SettingsPage
      onBack={onBack}
      onSignOut={onSignOut}
      onAccountDeleted={onAccountDeleted}
    />
  );

  await waitFor(() => expect(profileEq).toHaveBeenCalledWith("id", "user-1"));

  fireEvent.click(screen.getByText(/back/i));
  expect(onBack).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/min\. 6 chars, upper & lowercase, 1 number/i), {
    target: { value: "Secret123" },
  });
  fireEvent.change(screen.getByPlaceholderText(/repeat new password/i), {
    target: { value: "Secret123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument();
  expect(updateUser).toHaveBeenCalledWith({ password: "Secret123" });

  fireEvent.click(screen.getByRole("button", { name: /toggle message notifications/i }));
  fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
  expect(profileUpdateEq).toHaveBeenCalledWith("id", "user-1");
  expect(await screen.findByText(/preferences saved/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /toggle dark mode/i }));
  expect(document.documentElement).toHaveClass("dark");
  expect(localStorage.getItem("theme")).toBe("dark");

  fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));
  fireEvent.click(screen.getByRole("button", { name: /permanently delete/i }));
  expect(screen.getByText(/please type "delete" to confirm/i)).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("DELETE"), { target: { value: "DELETE" } });
  fireEvent.click(screen.getByRole("button", { name: /permanently delete/i }));

  await waitFor(() => expect(rpc).toHaveBeenCalledWith("delete_my_account"));
  expect(signOut).toHaveBeenCalled();
  expect(onSignOut).toHaveBeenCalled();
  expect(onAccountDeleted).toHaveBeenCalled();
});

test("ListingForm validates required fields and publishes a completed listing", async () => {
  const onCancel = vi.fn();
  const onSuccess = vi.fn();

  render(<ListingForm onCancel={onCancel} onSuccess={onSuccess} />);

  fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();

  const file = new File(["image"], "lamp.png", { type: "image/png" });
  const readerResult = "data:image/png;base64,bGFtcA==";
  class MockFileReader {
    readAsDataURL() {
      this.result = readerResult;
      this.onloadend();
    }
  }
  vi.stubGlobal("FileReader", MockFileReader);

  fireEvent.change(document.querySelector('input[type="file"]'), {
    target: { files: [file] },
  });
  expect(await screen.findByAltText(/upload 1/i)).toHaveAttribute("src", readerResult);

  fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: "Lamp" } });
  fireEvent.change(screen.getByLabelText(/asking price/i), { target: { value: "250.75" } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "Electronics" } });
  expect(screen.getByLabelText(/asking price/i)).toHaveValue("250.75");
  fireEvent.click(screen.getByRole("radio", { name: /good/i }));
  fireEvent.click(screen.getByRole("button", { name: /for trade/i }));
  fireEvent.click(screen.getByRole("button", { name: /publish listing/i }));

  await waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    title: "Lamp",
    price: 250.75,
    condition: "Good",
    listing_type: "trade",
    status: "active",
  })));
  expect(onSuccess).toHaveBeenCalled();
  expect(onCancel).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
