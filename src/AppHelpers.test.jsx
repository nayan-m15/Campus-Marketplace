import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ListingPriceCheck,
  buildAppPath,
  getPageForAppPath,
  getPageForPath,
  getPathForPage,
  getPriceFairness,
  getPriceSuggestionErrorMessage,
  hasPaymentReturnParams,
  isProfileComplete,
  isProtectedPage,
  normalizeBasePath,
  parseListingPriceValue,
  stripBasePath,
} from "./App";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: {
      invoke: (...args) => mocks.invoke(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

vi.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: vi.fn(),
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
    lastAuthEvent: null,
  }),
}));

vi.mock("./data/listings", () => ({
  CONDITIONS: ["All Conditions", "Good"],
  fetchListings: () => Promise.resolve([]),
}));

vi.mock("./components/NavBar", () => ({ default: () => null }));
vi.mock("./components/Hero", () => ({ default: () => null }));
vi.mock("./components/HowItWorksPage", () => ({ default: () => null }));
vi.mock("./components/FilterBar.jsx", () => ({ default: () => null }));
vi.mock("./components/ListingsGrid", () => ({ default: () => null }));
vi.mock("./components/Footer", () => ({ default: () => null }));
vi.mock("./components/LoginPage", () => ({ default: () => null }));
vi.mock("./components/ResetPasswordPage", () => ({ default: () => null }));
vi.mock("./components/SignupPage", () => ({ default: () => null }));
vi.mock("./components/ProfilePage", () => ({ default: () => null }));
vi.mock("./components/PublicProfilePage", () => ({ default: () => null }));
vi.mock("./components/ProfileSetupPage", () => ({ default: () => null }));
vi.mock("./components/MessagesPage", () => ({ default: () => null }));
vi.mock("./components/AdminDashboard.jsx", () => ({ default: () => null }));
vi.mock("./components/WishlistPage", () => ({ default: () => null }));
vi.mock("./components/VerifiedBadge", () => ({ default: () => null }));
vi.mock("./components/UnverifiedSellerWarning", () => ({ default: () => null }));
vi.mock("./components/ListingForm", () => ({ default: () => null }));
vi.mock("./components/TradeFacilityDashboard", () => ({ default: () => null }));
vi.mock("./components/YourListingsPage", () => ({ default: () => null }));
vi.mock("./components/SettingsPage", () => ({ default: () => null }));
vi.mock("./components/BookingsUi", () => ({ StudentBookingsPage: () => null }));
vi.mock("./components/RatingPromptModal", () => ({ default: () => null }));
vi.mock("./context/useWishlist", () => ({
  useWishlist: () => ({
    wishlistItems: [],
    isWishlisted: () => false,
    toggleWishlist: vi.fn(),
    loading: false,
  }),
}));
vi.mock("./utils/messageDelivery", () => ({
  insertMessage: vi.fn(),
}));

const detailedItem = {
  id: "listing-price-1",
  title: "Graphing Calculator",
  description: "Reliable calculator for engineering classes.",
  category: "Electronics",
  condition: "Good",
  price: "R 450",
  listing_type: "sale",
  status: "active",
  image_urls: ["https://example.com/calculator.jpg"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App route and price helpers", () => {
  test("normalizes, strips, and builds app paths", () => {
    expect(normalizeBasePath("campus")).toBe("/campus/");
    expect(normalizeBasePath("/campus")).toBe("/campus/");
    expect(normalizeBasePath("")).toBe("/");
    expect(stripBasePath("/campus/messages", "/campus/")).toBe("/messages");
    expect(stripBasePath("", "/campus/")).toBe("/");
    expect(buildAppPath("/", "/campus/")).toBe("/campus/");
    expect(buildAppPath("/messages/", "/campus/")).toBe("/campus/messages");
    expect(buildAppPath("/messages", "/")).toBe("/messages");
  });

  test("maps pages, protected routes, payment params, and profile completion", () => {
    expect(getPageForPath("/messages")).toBe("messages");
    expect(getPageForPath("/unknown")).toBe("home");
    expect(getPageForAppPath("/wishlist")).toBe("wishlist");
    expect(getPageForAppPath("/missing")).toBe("home");
    expect(getPathForPage("settings")).toBe("/settings");
    expect(getPathForPage("missing")).toBe("/");
    expect(isProtectedPage("bookings")).toBe(true);
    expect(isProtectedPage("home")).toBe(false);
    expect(hasPaymentReturnParams("?payment=success&transaction_id=txn-1")).toBe(true);
    expect(hasPaymentReturnParams("?payment=success")).toBe(false);
    expect(hasPaymentReturnParams("")).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ name: "A", sex: "F", birthdate: "2001-01-01", province: "Gauteng", institution: "UP" })).toBe(true);
    expect(isProfileComplete({ name: "A" })).toBe(false);
  });

  test("parses listing prices and maps price suggestion errors", () => {
    expect(parseListingPriceValue(120)).toBe(120);
    expect(parseListingPriceValue(Number.NaN)).toBeNull();
    expect(parseListingPriceValue("R 1 299,99")).toBe(1299.99);
    expect(parseListingPriceValue("R 1,299.99")).toBe(1299.99);
    expect(parseListingPriceValue("free")).toBeNull();
    expect(getPriceSuggestionErrorMessage({ message: "Failed to send a request to the Edge Function" })).toMatch(/could not be reached/i);
    expect(getPriceSuggestionErrorMessage({ message: "non-2xx status" })).toMatch(/reliable shopping/i);
    expect(getPriceSuggestionErrorMessage({ message: "not enough matches" })).toMatch(/reliable shopping/i);
    expect(getPriceSuggestionErrorMessage({ message: "not found" })).toMatch(/not enough comparable/i);
    expect(getPriceSuggestionErrorMessage({ message: "inconclusive" })).toMatch(/reliable shopping/i);
    expect(getPriceSuggestionErrorMessage({})).toMatch(/unavailable/i);
  });

  test("classifies price fairness states", () => {
    const suggestion = {
      suggestedPrice: 500,
      suggestedRange: { min: 450, max: 550 },
      confidence: { level: "High" },
    };
    expect(getPriceFairness(null, suggestion, detailedItem)).toMatchObject({ label: "Price check", tone: "neutral" });
    expect(getPriceFairness(450, { ...suggestion, confidence: { level: "Low" } }, detailedItem)).toMatchObject({ label: "Price check inconclusive", showRange: false });
    expect(getPriceFairness(450, suggestion, { ...detailedItem, listing_type: "trade" })).toMatchObject({ label: "Estimated trade value", showRange: true });
    expect(getPriceFairness(300, suggestion, detailedItem)).toMatchObject({ label: "Very good price", tone: "good" });
    expect(getPriceFairness(500, suggestion, detailedItem)).toMatchObject({ label: "Good price", tone: "good" });
    expect(getPriceFairness(650, suggestion, detailedItem)).toMatchObject({ label: "Fair price", tone: "fair" });
    expect(getPriceFairness(800, suggestion, detailedItem)).toMatchObject({ label: "High price", tone: "high" });
  });
});

describe("ListingPriceCheck", () => {
  test("renders paused, unavailable, loading, success, and error states", async () => {
    expect(render(<ListingPriceCheck item={{ ...detailedItem, price: "free" }} />).container).toBeEmptyDOMElement();

    const flagged = render(<ListingPriceCheck item={{ ...detailedItem, id: "flagged-price", status: "flagged" }} />);
    expect(screen.getByText(/price check paused/i)).toBeInTheDocument();
    flagged.unmount();

    const missing = render(<ListingPriceCheck item={{ ...detailedItem, id: "missing-price", category: "" }} />);
    expect(screen.getByText(/price check unavailable/i)).toBeInTheDocument();
    missing.unmount();

    mocks.invoke.mockResolvedValueOnce({
      data: {
        suggestedPrice: 500,
        suggestedPriceFormatted: "R 500",
        suggestedRange: { min: 450, max: 550, minFormatted: "R 450", maxFormatted: "R 550" },
        confidence: { level: "High" },
        pricingBasis: { label: "Google Shopping SA" },
      },
      error: null,
    });
    render(<ListingPriceCheck item={detailedItem} />);
    expect(screen.getByText(/checking price/i)).toBeInTheDocument();
    expect(await screen.findByText(/good price/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested range/i)).toBeInTheDocument();

    mocks.invoke.mockResolvedValueOnce({ data: null, error: { message: "non-2xx status code" } });
    render(<ListingPriceCheck item={{ ...detailedItem, id: "error-price" }} />);
    expect(await screen.findByText(/we could not compare this listing/i)).toBeInTheDocument();

    mocks.invoke.mockResolvedValueOnce({ data: { error: "not found" }, error: null });
    render(<ListingPriceCheck item={{ ...detailedItem, id: "data-error-price" }} />);
    await waitFor(() => expect(screen.getByText(/not enough comparable/i)).toBeInTheDocument());
  });
});
