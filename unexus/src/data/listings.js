import { supabase } from "../supabaseClient";

// ─── Static Config ────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { label: "All Items", emoji: "🛍️" },
  { label: "Textbooks", emoji: "📚" },
  { label: "Electronics", emoji: "💻" },
  { label: "Furniture", emoji: "🛋️" },
  { label: "Clothing", emoji: "👕" },
  { label: "Sports", emoji: "⚽" },
  { label: "Instruments", emoji: "🎸" },
  { label: "Stationery", emoji: "✏️" },
  { label: "Other", emoji: "📦" },
];

export const CONDITION_COLORS = {
  Excellent: "#10b981",
  "Like New": "#3b82f6",
  Good: "#f59e0b",
  Fair: "#ef4444",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price) {
  if (price === null || price === undefined) return "R 0";
  return `R ${Number(price).toLocaleString("en-ZA")}`;
}

function getCategoryEmoji(category) {
  const match = CATEGORIES.find((c) => c.label === category);
  return match ? match.emoji : "📦";
}

function getJoinedYear(createdAt) {
  if (!createdAt) return null;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  return date.getFullYear();
}

function getSellerName(profile, userId) {
  if (profile?.display_name?.trim()) return profile.display_name;
  if (profile?.name?.trim()) return profile.name;
  if (userId) return userId.slice(0, 8);
  return "Unknown";
}

function normaliseListing(listing, profile) {
  const category = listing.category ?? "Other";

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description ?? "",
    price: formatPrice(listing.price),
    category,
    condition: listing.condition ?? "Good",
    seller: getSellerName(profile, listing.user_id),
    user_id: listing.user_id,
    approximate_location: profile?.province ?? "Location not provided",
    joined_year: getJoinedYear(profile?.created_at),
    distance: "0 km",
    image_url: listing.image_url ?? null,
    emoji: listing.image_url ? null : getCategoryEmoji(category),
  };
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

export async function fetchListings() {
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, description, price, condition, user_id, image_url, category")
    .order("created_at", { ascending: false });

  console.log("LISTINGS:", listings);
  console.log("LISTINGS ERROR:", listingsError);

  if (listingsError) {
    console.error("Failed to fetch listings:", listingsError.message);
    throw listingsError;
  }

  const userIds = [
    ...new Set((listings || []).map((listing) => listing.user_id).filter(Boolean)),
  ];

  console.log("USER IDS:", userIds);

  let profilesMap = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, name, province, created_at")
      .in("id", userIds);

    console.log("PROFILES:", profiles);
    console.log("PROFILES ERROR:", profilesError);

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError.message);
    } else {
      profilesMap = Object.fromEntries(
        profiles.map((profile) => [profile.id, profile])
      );
    }
  }

  console.log("PROFILES MAP:", profilesMap);

  const normalisedListings = (listings || []).map((listing) =>
    normaliseListing(listing, profilesMap[listing.user_id])
  );

  console.log("NORMALISED LISTINGS:", normalisedListings);

  return normalisedListings;
}

export async function fetchListingById(id) {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, title, description, price, condition, user_id, image_url, category")
    .eq("id", id)
    .single();

  if (listingError) {
    console.error("Failed to fetch listing:", listingError.message);
    throw listingError;
  }

  let profile = null;

  if (listing.user_id) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, name, province, created_at")
      .eq("id", listing.user_id)
      .single();

    if (profileError) {
      console.error("Failed to fetch seller profile:", profileError.message);
    } else {
      profile = profileData;
    }
  }

  return normaliseListing(listing, profile);
}