BEGIN;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_listing_ids TEXT[] := ARRAY[]::TEXT[];
  v_transaction_ids TEXT[] := ARRAY[]::TEXT[];
  v_booking_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to delete your account.';
  END IF;

  SELECT COALESCE(array_agg(id::TEXT), ARRAY[]::TEXT[])
    INTO v_listing_ids
  FROM public.listings
  WHERE user_id::TEXT = v_user_id::TEXT;

  SELECT
    COALESCE(array_agg(id::TEXT), ARRAY[]::TEXT[]),
    COALESCE(array_agg(dropoff_id::TEXT) FILTER (WHERE dropoff_id IS NOT NULL), ARRAY[]::TEXT[]) ||
    COALESCE(array_agg(collection_id::TEXT) FILTER (WHERE collection_id IS NOT NULL), ARRAY[]::TEXT[])
    INTO v_transaction_ids, v_booking_ids
  FROM public.transactions
  WHERE seller_id::TEXT = v_user_id::TEXT
     OR buyer_id::TEXT = v_user_id::TEXT
     OR listing_id::TEXT = ANY(v_listing_ids)
     OR requested_listing_id::TEXT = ANY(v_listing_ids)
     OR offered_listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.wishlists
  WHERE user_id::TEXT = v_user_id::TEXT
     OR listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.ratings
  WHERE rater_id::TEXT = v_user_id::TEXT
     OR rated_id::TEXT = v_user_id::TEXT
     OR listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.messages
  WHERE sender_id::TEXT = v_user_id::TEXT
     OR receiver_id::TEXT = v_user_id::TEXT
     OR listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.offers
  WHERE sender_id::TEXT = v_user_id::TEXT
     OR receiver_id::TEXT = v_user_id::TEXT
     OR listing_id::TEXT = ANY(v_listing_ids)
     OR requested_listing_id::TEXT = ANY(v_listing_ids)
     OR offered_listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.price_suggestion_cache
  WHERE listing_id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.transactions
  WHERE id::TEXT = ANY(v_transaction_ids);

  DELETE FROM public.bookings
  WHERE id::TEXT = ANY(v_booking_ids);

  DELETE FROM public.listings
  WHERE id::TEXT = ANY(v_listing_ids);

  DELETE FROM public.profiles
  WHERE id::TEXT = v_user_id::TEXT;

  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMIT;
