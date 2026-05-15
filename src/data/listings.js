import { supabase } from "../supabaseClient";

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
  New: "#1F6B52",
  "Like New": "#7D8F86",
  Good: "#E59D3A",
  Fair: "#C75B4A",
  Poor: "#A0AAA2",
};

export const CONDITIONS = ["All Conditions", ...Object.keys(CONDITION_COLORS)];

const LISTING_SELECT =
  "id, title, description, price, condition, user_id, image_url, image_urls, category, status, listing_type, flag_reason, created_at";

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
    institution: "University of Johannesburg",
    approximate_location: "Gauteng",
    joined_year: 2026,
    joined_label: "April 2026",
    image_url: null,
    image_urls: [],
    emoji: "📚",
    status: "active",
    flag_reason: "",
  },
];

function formatPrice(price) {
  if (price === null || price === undefined) return "R 0";
  const num = Number(price);
  const hasCents = Math.round(num * 100) % 100 !== 0;
  return `R ${num.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).replace(/,/g, " ")}`;
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

function getJoinedLabel(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getSellerName(profile, userId) {
  if (profile?.display_name?.trim()) return profile.display_name;
  if (profile?.name?.trim()) return profile.name;
  if (userId) return userId.slice(0, 8);
  return "Unknown";
}

export function normaliseListing(listing, profile) {
  const category = listing.category ?? "Other";
  const imageUrls = Array.isArray(listing.image_urls)
    ? listing.image_urls.filter(Boolean)
    : [];
  const primaryImage = listing.image_url ?? imageUrls[0] ?? null;

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
    institution: profile?.institution ?? "",
    approximate_location: profile?.province ?? "Location not provided",
    joined_year: getJoinedYear(profile?.created_at),
    joined_label: getJoinedLabel(profile?.created_at),
    image_url: primaryImage,
    image_urls: primaryImage
      ? [primaryImage, ...imageUrls.filter((url) => url !== primaryImage)]
      : imageUrls,
    emoji: primaryImage ? null : getCategoryEmoji(category),
    listing_type: listing.listing_type ?? "sale",
    status: listing.status ?? "active",
    flag_reason: listing.flag_reason ?? "",
    created_at: listing.created_at ?? null,
  };
}

export async function fetchListings(currentUserId = null) {
  try {
    let query = supabase
      .from("listings")
      .select(LISTING_SELECT)
      .neq("status", "sold")
      .neq("status", "traded")
      .order("created_at", { ascending: false });

    if (currentUserId) {
      query = query.neq("user_id", currentUserId);
    }

    const { data: listings, error } = await query;

    if (error) throw error;

    const userIds = [
      ...new Set((listings || []).map((listing) => listing.user_id).filter(Boolean)),
    ];

    let profilesMap = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, name, province, institution, created_at")
        .in("id", userIds);

      if (profilesError) {
        console.error("Failed to fetch profiles:", profilesError.message);
      } else {
        profilesMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
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

export async function fetchListingById(id) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;

  let profile = null;

  if (listing.user_id) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, name, province, institution, created_at")
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
