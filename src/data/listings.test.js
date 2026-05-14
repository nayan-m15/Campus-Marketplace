import { beforeEach, expect, test, vi } from "vitest";
import { fetchListingById, fetchListings, normaliseListing } from "./listings";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

/*This function creates the listings query.*/
function makeListingsQuery({ data, error }) {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
  };
  return query;
}

/*This function creates the profiles query.*/
function makeProfilesQuery({ data, error }) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => Promise.resolve({ data, error })),
    eq: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data, error })),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("normaliseListing formats price, prefers profile display name, and promotes the cover image", () => {
  const result = normaliseListing(
    {
      id: "listing-1",
      title: "Desk Lamp",
      description: null,
      price: 250.5,
      category: "Furniture",
      condition: null,
      user_id: "seller-12345678",
      image_url: null,
      image_urls: ["https://example.com/b.jpg", "https://example.com/a.jpg"],
      listing_type: null,
      status: null,
      flag_reason: null,
    },
    {
      display_name: "Seller Name",
      province: "Gauteng",
      institution: "Wits",
      created_at: "2025-02-01T00:00:00.000Z",
    }
  );

  expect(result).toMatchObject({
    id: "listing-1",
    title: "Desk Lamp",
    description: "",
    price: "R 250.50",
    category: "Furniture",
    condition: "Good",
    seller: "Seller Name",
    institution: "Wits",
    approximate_location: "Gauteng",
    image_url: "https://example.com/b.jpg",
    image_urls: ["https://example.com/b.jpg", "https://example.com/a.jpg"],
    listing_type: "sale",
    status: "active",
    flag_reason: "",
  });
  expect(result.joined_year).toBe(2025);
  expect(result.joined_label).toMatch(/2025/);
  expect(result.emoji).toBeNull();
});

test("fetchListings returns normalized rows with seller profile details", async () => {
  const listingsQuery = makeListingsQuery({
    data: [
      {
        id: "listing-2",
        title: "Textbook",
        description: "Good copy",
        price: 500,
        category: "Textbooks",
        condition: "Like New",
        user_id: "seller-1",
        image_url: null,
        image_urls: [],
        listing_type: "trade",
        status: "flagged",
        flag_reason: "Suspicious payment request.",
      },
    ],
    error: null,
  });
  const profilesQuery = makeProfilesQuery({
    data: [
      {
        id: "seller-1",
        display_name: "Amina",
        name: "Seller Name",
        province: "Western Cape",
        institution: "UCT",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ],
    error: null,
  });

  mocks.from.mockImplementation((table) => {
    if (table === "listings") return listingsQuery;
    if (table === "profiles") return profilesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const result = await fetchListings("user-1");

  expect(listingsQuery.neq).toHaveBeenCalledWith("status", "sold");
  expect(listingsQuery.neq).toHaveBeenCalledWith("user_id", "user-1");
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    title: "Textbook",
    seller: "Amina",
    institution: "UCT",
    listing_type: "trade",
    status: "flagged",
    flag_reason: "Suspicious payment request.",
    emoji: "📚",
  });
});

test("fetchListings falls back to mock listings when the query fails", async () => {
  const listingsQuery = makeListingsQuery({
    data: null,
    error: { message: "boom" },
  });

  mocks.from.mockImplementation((table) => {
    if (table === "listings") return listingsQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const result = await fetchListings();

  expect(result).toHaveLength(1);
  expect(result[0].title).toBe("Calculus Textbook 8th Ed.");
});

test("fetchListingById returns a normalized listing even when seller profile lookup fails", async () => {
  const listingsQuery = makeListingsQuery({
    data: {
      id: "listing-3",
      title: "Keyboard",
      description: "Mechanical",
      price: 900,
      category: "Electronics",
      condition: "Good",
      user_id: "seller-2",
      image_url: null,
      image_urls: [],
      listing_type: "sale",
      status: "active",
      flag_reason: "",
    },
    error: null,
  });
  const profilesQuery = makeProfilesQuery({
    data: null,
    error: { message: "profile error" },
  });

  mocks.from.mockImplementation((table) => {
    if (table === "listings") return listingsQuery;
    if (table === "profiles") return profilesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const result = await fetchListingById("listing-3");

  expect(result).toMatchObject({
    id: "listing-3",
    title: "Keyboard",
    seller: "seller-2",
    institution: "",
    approximate_location: "Location not provided",
  });
});
