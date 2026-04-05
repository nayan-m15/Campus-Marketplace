import { supabase } from "../supabaseClient"; // ← adjust path to match your project structure

// ─── Static Config ────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { label: "All Items",   emoji: "🛍️" },
  { label: "Textbooks",   emoji: "📚" },
  { label: "Electronics", emoji: "💻" },
  { label: "Furniture",   emoji: "🛋️" },
  { label: "Clothing",    emoji: "👕" },
  { label: "Sports",      emoji: "⚽" },
  { label: "Instruments", emoji: "🎸" },
  { label: "Stationery",  emoji: "✏️" },
  { label: "Other",       emoji: "📦" },
];

export const CONDITION_COLORS = {
  Excellent:  "#10b981",
  "Like New": "#3b82f6",
  Good:       "#f59e0b",
  Fair:       "#ef4444",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a raw numeric price from the DB into a display string.
 */
function formatPrice(price) {
  if (price === null || price === undefined) return "R 0";
  return `R ${Number(price).toLocaleString("en-ZA")}`;
}

function getCategoryEmoji(category) {
  const match = CATEGORIES.find((c) => c.label === category);
  return match ? match.emoji : "📦";
}

/**
 * Returns a shortened seller label from a UUID.
 * NOTE: Replace this with a profiles table join once you have one.
 * In Supabase, create a `profiles` table with columns (id uuid, display_name text)
 * that mirrors auth.users, then join on user_id to get real names.
 */
function formatSeller(userId) {
  if (!userId) return "Unknown";
  return userId.slice(0, 8);
}

//Data Fetching 

/**
 * Fetches all listings from Supabase and normalises them
 * into the shape expected by your UI components.
 *
 * ⚠️  CATEGORY: Your `listings` table currently has no `category` column.
 *     Add one (type: text) in Supabase and populate it when users create listings.
 *     Until then, every listing will fall back to "Other".
 *
 * Usage:
 *   const listings = await fetchListings();
 *   const filtered = listings.filter(l => l.category === "Electronics");
 */
export async function fetchListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, description, price, condition, user_id, image_url, category")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch listings:", error.message);
    throw error;
  }

  return data.map((listing) => {
    const category = listing.category ?? "Other";

    return {
      id:          listing.id,
      title:       listing.title,
      description: listing.description ?? "",
      price:       formatPrice(listing.price),
      category:    category,
      condition:   listing.condition ?? "Good",
      seller:      formatSeller(listing.user_id),
      distance:    "0 km",                          // placeholder — add geolocation later
      image_url:   listing.image_url ?? null,
      emoji:       listing.image_url              
                     ? null
                     : getCategoryEmoji(category),
    };
  });
}

/**
 * Fetches a single listing by its UUID.
 * Useful for a listing detail/modal view.
 */
export async function fetchListingById(id) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, description, price, condition, user_id, image_url, category")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch listing:", error.message);
    throw error;
  }

  const category = data.category ?? "Other";

  return {
    id:          data.id,
    title:       data.title,
    description: data.description ?? "",
    price:       formatPrice(data.price),
    category:    category,
    condition:   data.condition ?? "Good",
    seller:      formatSeller(data.user_id),
    distance:    "0 km",
    image_url:   data.image_url ?? null,
    emoji:       data.image_url ? null : getCategoryEmoji(category),
  };
}