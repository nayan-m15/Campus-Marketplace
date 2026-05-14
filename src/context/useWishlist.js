import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { normaliseListing } from "../data/listings";

/**
 * useWishlist — manages wishlist state for the current user.
 *
 * Returns:
 *   wishlistIds   — Set of listing IDs the user has wishlisted
 *   wishlistItems — Full listing objects for the wishlist page
 *   isWishlisted  — (listingId) => boolean
 *   toggleWishlist — (listingId) => Promise<void>  adds or removes
 *   loading       — boolean
 */
export function useWishlist(user) {
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all wishlist entries (with joined listing data) for current user
  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setWishlistIds(new Set());
      setWishlistItems([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wishlists")
        .select(`
          listing_id,
          listings (
            id,
            title,
            price,
            condition,
            category,
            image_url,
            image_urls,
            description,
            user_id,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const ids = new Set(data.map((row) => row.listing_id));
      const rawListings = data
        .map((row) => row.listings)
        .filter(Boolean); // remove nulls if a listing was deleted

      const userIds = [
        ...new Set(rawListings.map((listing) => listing.user_id).filter(Boolean)),
      ];

      let profilesMap = {};

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, name, province, institution, created_at")
          .in("id", userIds);

        if (profilesError) {
          console.error("Failed to fetch wishlist seller profiles:", profilesError.message);
        } else {
          profilesMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
        }
      }

      const items = rawListings.map((listing) =>
        normaliseListing(listing, profilesMap[listing.user_id])
      );

      setWishlistIds(ids);
      setWishlistItems(items);
    } catch (err) {
      console.error("Failed to fetch wishlist:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isWishlisted = useCallback(
    (listingId) => wishlistIds.has(listingId),
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (listingId) => {
      if (!user) return;

      const alreadyWishlisted = wishlistIds.has(listingId);

      // Optimistic update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        alreadyWishlisted ? next.delete(listingId) : next.add(listingId);
        return next;
      });

      if (!alreadyWishlisted) {
        setWishlistItems((prev) => {
          // We don't have full listing data here; the page re-fetch will fill it in
          return prev;
        });
      } else {
        setWishlistItems((prev) =>
          prev.filter((item) => item.id !== listingId)
        );
      }

      try {
        if (alreadyWishlisted) {
          const { error } = await supabase
            .from("wishlists")
            .delete()
            .eq("user_id", user.id)
            .eq("listing_id", listingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("wishlists")
            .insert({ user_id: user.id, listing_id: listingId });
          if (error) throw error;
          // Re-fetch to get the full listing object
          await fetchWishlist();
        }
      } catch (err) {
        console.error("Wishlist toggle failed:", err.message);
        // Revert optimistic update on failure
        await fetchWishlist();
      }
    },
    [user, wishlistIds, fetchWishlist]
  );

  return { wishlistIds, wishlistItems, isWishlisted, toggleWishlist, loading };
}
