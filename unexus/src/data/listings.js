import { supabase } from "../supabaseClient";

// ─── Static Config ─────────────────────────────────────────

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
  New: "#10b981",
  "Like New": "#3b82f6",
  Good: "#f59e0b",
  Fair: "#ef4444",
  Poor: "#9ca3af",
};

export const CONDITIONS = ["All Conditions", ...Object.keys(CONDITION_COLORS)];

// ─── Mock fallback (used if Supabase fails) ─────────────────

const MOCK_LISTINGS = [
  {
    id: 1,
    title: "Calculus Textbook 8th Ed.",
    description: "Good condition university textbook.",
    price: "R 320",
    category: "Textbooks",
    condition: "Good",
    seller: "Mock User",
    user_id: "mock-user",
    approximate_location: "Gauteng",
    joined_year: 2026,
    distance: "0.3 km",
    image_url: null,
    emoji: "📚",
  },
];

// ─── Helpers ───────────────────────────────────────────────

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
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
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
    price:
      typeof listing.price === "string"
        ? listing.price
        : formatPrice(listing.price),
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

// ─── Main Fetch Function ───────────────────────────────────

export async function fetchListings() {
  try {
    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, title, description, price, condition, user_id, image_url, category")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = [
      ...new Set((listings || []).map((l) => l.user_id).filter(Boolean)),
    ];

    let profilesMap = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, name, province, created_at")
        .in("id", userIds);

      if (profilesError) {
        console.error("Failed to fetch profiles:", profilesError.message);
      } else {
        profilesMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      }
    }

    return (listings || []).map((listing) =>
      normaliseListing(listing, profilesMap[listing.user_id])
    );
  } catch (err) {
    console.error("Using mock listings due to error:", err.message);
    return MOCK_LISTINGS;
  }
}

// ─── Single Listing ────────────────────────────────────────

export async function fetchListingById(id) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, description, price, condition, user_id, image_url, category")
    .eq("id", id)
    .single();

  if (error) throw error;

  let profile = null;

  if (listing.user_id) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, name, province, created_at")
      .eq("id", listing.user_id)
      .single();

    if (profileError) {
      console.error("Failed to fetch seller profile:", profileError.message);
    } else {
      profile = data;
    }
  }

  return normaliseListing(listing, profile);
}