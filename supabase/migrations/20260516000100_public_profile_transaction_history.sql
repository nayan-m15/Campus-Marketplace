CREATE OR REPLACE FUNCTION public.get_public_transaction_history(p_profile_user_id UUID)
RETURNS TABLE (
  transaction_id TEXT,
  item_title TEXT,
  item_image_url TEXT,
  relationship_label TEXT,
  other_user_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    transaction_row.id AS transaction_id,
    COALESCE(listing_row.title, transaction_row.requested_item, transaction_row.item, 'Transaction item') AS item_title,
    COALESCE(listing_row.image_url, transaction_row.offered_item_image_url, '') AS item_image_url,
    CASE
      WHEN transaction_row.seller_id = p_profile_user_id THEN 'Sold to'
      ELSE 'Bought from'
    END AS relationship_label,
    COALESCE(other_profile.display_name, other_profile.name, LEFT(other_profile.id::TEXT, 8), 'Unknown user') AS other_user_name,
    transaction_row.created_at
  FROM public.transactions AS transaction_row
  LEFT JOIN public.listings AS listing_row
    ON listing_row.id::TEXT = COALESCE(
      transaction_row.listing_id::TEXT,
      transaction_row.requested_listing_id::TEXT,
      transaction_row.offered_listing_id::TEXT
    )
  LEFT JOIN public.profiles AS other_profile
    ON other_profile.id = CASE
      WHEN transaction_row.seller_id = p_profile_user_id THEN transaction_row.buyer_id
      ELSE transaction_row.seller_id
    END
  WHERE p_profile_user_id IS NOT NULL
    AND (transaction_row.seller_id = p_profile_user_id OR transaction_row.buyer_id = p_profile_user_id)
  ORDER BY transaction_row.created_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_transaction_history(UUID) TO anon, authenticated;
