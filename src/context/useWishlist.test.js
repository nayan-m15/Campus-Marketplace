import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useWishlist } from "./useWishlist";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  normaliseListing: vi.fn((listing, profile) => ({
    ...listing,
    seller: profile?.display_name || profile?.name || "Unknown",
  })),
}));

vi.mock("../supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("../data/listings", () => ({
  normaliseListing: (...args) => mocks.normaliseListing(...args),
}));

/*This function creates the wishlist list query.*/
function makeWishlistListQuery({ data, error }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => Promise.resolve({ data, error })),
    delete: vi.fn(() => query),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return query;
}

/*This function creates the profiles query.*/
function makeProfilesQuery({ data, error }) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => Promise.resolve({ data, error })),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const wishlistUser = { id: "user-1" };

test("useWishlist clears state immediately when there is no user", async () => {
  const { result } = renderHook(() => useWishlist(null));

  await waitFor(() => {
    expect(result.current.wishlistItems).toEqual([]);
    expect(result.current.wishlistIds.size).toBe(0);
  });
});

test("useWishlist loads wishlist ids and normalized items for a signed-in user", async () => {
  const wishlistsQuery = makeWishlistListQuery({
    data: [
      {
        listing_id: "listing-1",
        listings: {
          id: "listing-1",
          title: "Desk Lamp",
          user_id: "seller-1",
        },
      },
    ],
    error: null,
  });
  const profilesQuery = makeProfilesQuery({
    data: [{ id: "seller-1", display_name: "Seller Name" }],
    error: null,
  });

  mocks.from.mockImplementation((table) => {
    if (table === "wishlists") return wishlistsQuery;
    if (table === "profiles") return profilesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const { result } = renderHook(() => useWishlist(wishlistUser));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.isWishlisted("listing-1")).toBe(true);
    expect(result.current.wishlistItems[0]).toMatchObject({
      id: "listing-1",
      title: "Desk Lamp",
      seller: "Seller Name",
    });
  });
});

test("useWishlist removes an existing wishlist item", async () => {
  const wishlistsQuery = makeWishlistListQuery({
    data: [
      {
        listing_id: "listing-1",
        listings: {
          id: "listing-1",
          title: "Desk Lamp",
          user_id: "seller-1",
        },
      },
    ],
    error: null,
  });
  const deleteEqListingId = vi.fn(() => Promise.resolve({ error: null }));
  const deleteEqUserId = vi.fn(() => ({ eq: deleteEqListingId }));
  wishlistsQuery.delete = vi.fn(() => ({ eq: deleteEqUserId }));

  const profilesQuery = makeProfilesQuery({
    data: [{ id: "seller-1", display_name: "Seller Name" }],
    error: null,
  });

  mocks.from.mockImplementation((table) => {
    if (table === "wishlists") return wishlistsQuery;
    if (table === "profiles") return profilesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const { result } = renderHook(() => useWishlist(wishlistUser));

  await waitFor(() => expect(result.current.isWishlisted("listing-1")).toBe(true));

  await act(async () => {
    await result.current.toggleWishlist("listing-1");
  });

  await waitFor(() => {
    expect(result.current.isWishlisted("listing-1")).toBe(false);
    expect(deleteEqUserId).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteEqListingId).toHaveBeenCalledWith("listing_id", "listing-1");
  });
});

test("useWishlist adds a new wishlist item and refetches on success", async () => {
  const wishlistsQuery = makeWishlistListQuery({ data: [], error: null });
  const insertMock = vi.fn(() => Promise.resolve({ error: null }));
  wishlistsQuery.insert = insertMock;

  const profilesQuery = makeProfilesQuery({ data: [], error: null });

  mocks.from.mockImplementation((table) => {
    if (table === "wishlists") return wishlistsQuery;
    if (table === "profiles") return profilesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  const { result } = renderHook(() => useWishlist(wishlistUser));

  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await result.current.toggleWishlist("listing-2");
  });

  expect(insertMock).toHaveBeenCalledWith({ user_id: "user-1", listing_id: "listing-2" });
});
