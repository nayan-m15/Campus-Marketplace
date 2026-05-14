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
/*This function manages wishlist state and actions for the current signed-in user.*/
export function useWishlist(user) {
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /*This function loads the user's wishlist IDs and full listing details from the database.*/
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
        .filter(Boolean);

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

  /*This function returns true when a listing ID is already saved in the wishlist.*/
  const isWishlisted = useCallback(
    (listingId) => wishlistIds.has(listingId),
    [wishlistIds]
  );

  /*This function adds or removes a listing from the wishlist and refreshes the data when needed.*/
  const toggleWishlist = useCallback(
    async (listingId) => {
      if (!user) return;

      const alreadyWishlisted = wishlistIds.has(listingId);

      setWishlistIds((prev) => {
        const next = new Set(prev);
        alreadyWishlisted ? next.delete(listingId) : next.add(listingId);
        return next;
      });

      if (!alreadyWishlisted) {
        setWishlistItems((prev) => {
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
          await fetchWishlist();
        }
      } catch (err) {
        console.error("Wishlist toggle failed:", err.message);
        await fetchWishlist();
      }
    },
    [user, wishlistIds, fetchWishlist]
  );

  return { wishlistIds, wishlistItems, isWishlisted, toggleWishlist, loading };
}
