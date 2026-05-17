import { render, screen, fireEvent, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Navbar from "./NavBar";

vi.mock("./NotificationBell", () => ({
  default: () => <button type="button">Notifications</button>,
}));

function makeProps(overrides = {}) {
  return {
    searchQuery: "",
    onSearchChange: vi.fn(),
    onSearchFocus: vi.fn(),
    user: {
      email: "student@example.com",
      user_metadata: { full_name: "Metadata Name" },
    },
    avatarUrl: "",
    profile: { display_name: "Campus Seller", name: "Profile Name" },
    profileName: "Fallback Name",
    onLogin: vi.fn(),
    onSignup: vi.fn(),
    onSignOut: vi.fn(),
    onShowListingForm: vi.fn(),
    onProfile: vi.fn(),
    onMessages: vi.fn(),
    onHome: vi.fn(),
    onYourListings: vi.fn(),
    onBookings: vi.fn(),
    onTransactionHistory: vi.fn(),
    onWishlist: vi.fn(),
    wishlistCount: 3,
    unreadCount: 105,
    onSettings: vi.fn(),
    onAdminDashboard: vi.fn(),
    isAdmin: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Navbar", () => {
  test("renders authenticated desktop actions and invokes primary callbacks", () => {
    const props = makeProps();
    render(<Navbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /go to homepage/i }));
    fireEvent.change(screen.getByPlaceholderText(/search textbooks/i), { target: { value: "books" } });
    fireEvent.focus(screen.getByPlaceholderText(/search textbooks/i));
    fireEvent.click(screen.getAllByRole("button", { name: /messages/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: /campus seller/i }));
    fireEvent.click(screen.getByRole("button", { name: /my bookings/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /list item/i })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /sign out/i })[0]);

    expect(props.onHome).toHaveBeenCalled();
    expect(props.onSearchChange).toHaveBeenCalledWith("books");
    expect(props.onSearchFocus).toHaveBeenCalled();
    expect(props.onMessages).toHaveBeenCalled();
    expect(props.onProfile).toHaveBeenCalled();
    expect(props.onBookings).toHaveBeenCalled();
    expect(props.onShowListingForm).toHaveBeenCalled();
    expect(props.onSignOut).toHaveBeenCalled();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  test("opens mobile search, focuses it, updates query, closes from button and outside click", () => {
    const props = makeProps({ searchQuery: "lamp" });
    render(<Navbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    const mobileInput = screen.getByPlaceholderText("Search");
    expect(mobileInput).toHaveFocus();
    fireEvent.change(mobileInput, { target: { value: "calculator" } });
    fireEvent.click(screen.getByRole("button", { name: /close search/i }));
    expect(screen.queryByRole("button", { name: /close search/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open search/i }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("button", { name: /close search/i })).not.toBeInTheDocument();
    expect(props.onSearchChange).toHaveBeenCalledWith("calculator");
  });

  test("uses the side menu for authenticated admin account actions", () => {
    const props = makeProps();
    render(<Navbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /your listings/i }));
    expect(props.onYourListings).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /admin dashboard/i }));
    expect(props.onAdminDashboard).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /transaction history/i }));
    expect(props.onTransactionHistory).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /wishlist/i }));
    expect(props.onWishlist).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(props.onSettings).toHaveBeenCalled();
  });

  test("renders logged-out actions and side menu callbacks", () => {
    const props = makeProps({ user: null, profile: null, wishlistCount: 0, unreadCount: 0 });
    render(<Navbar {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign up free/i }));
    expect(props.onLogin).toHaveBeenCalled();
    expect(props.onSignup).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(within(screen.getByRole("navigation", { name: /side menu/i })).getByRole("button", { name: /^log in$/i }));
    expect(props.onLogin).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    fireEvent.click(within(screen.getByRole("navigation", { name: /side menu/i })).getByRole("button", { name: /^sign up$/i }));
    expect(props.onSignup).toHaveBeenCalledTimes(2);
  });

  test("falls back to user metadata, email, and generic profile labels", () => {
    const { rerender } = render(<Navbar {...makeProps({ profile: null, profileName: "", avatarUrl: "avatar.png" })} />);
    expect(screen.getByRole("button", { name: /metadata name/i })).toBeInTheDocument();
    expect(screen.getByAltText(/profile/i)).toHaveAttribute("src", "avatar.png");

    rerender(<Navbar {...makeProps({ profile: null, profileName: "", user: { email: "plain@example.com", user_metadata: {} } })} />);
    expect(screen.getByRole("button", { name: /plain/i })).toBeInTheDocument();

    rerender(<Navbar {...makeProps({ profile: null, profileName: "", user: { email: "", user_metadata: {} } })} />);
    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
  });
});
