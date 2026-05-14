BEGIN;

CREATE OR REPLACE FUNCTION public.accept_cash_offer_for_payment(p_offer_id TEXT)
RETURNS TABLE (
  offer_id TEXT,
  transaction_id TEXT,
  listing_title TEXT,
  amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_seller_id UUID;
  v_buyer_id UUID;
  v_transaction_id TEXT;
BEGIN
  SELECT *
    INTO v_offer
    FROM public.offers
   WHERE id::TEXT = p_offer_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found.';
  END IF;

  IF COALESCE(v_offer.offer_type, 'cash') <> 'cash' THEN
    RAISE EXCEPTION 'Only cash offers can be accepted for PayFast payment.';
  END IF;

  IF v_offer.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending offers can be accepted.';
  END IF;

  IF v_offer.amount IS NULL OR v_offer.amount <= 0 THEN
    RAISE EXCEPTION 'Cash offer amount is invalid.';
  END IF;

  SELECT *
    INTO v_listing
    FROM public.listings
   WHERE id::TEXT = v_offer.listing_id::TEXT
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found.';
  END IF;

  v_seller_id := v_listing.user_id;
  v_buyer_id := CASE
    WHEN v_offer.sender_id = v_seller_id THEN v_offer.receiver_id
    ELSE v_offer.sender_id
  END;

  IF auth.uid() IS DISTINCT FROM v_seller_id THEN
    RAISE EXCEPTION 'Only the listing owner can accept this offer.';
  END IF;

  SELECT id
    INTO v_transaction_id
    FROM public.transactions
   WHERE seller_id = v_seller_id
     AND buyer_id = v_buyer_id
     AND item = COALESCE(v_listing.title, 'Marketplace item')
     AND COALESCE(status, '') NOT IN ('item_released', 'completed', 'cancelled')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_transaction_id IS NULL THEN
    v_transaction_id := 'TXN-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12));

    INSERT INTO public.transactions (
      id,
      item,
      seller_id,
      buyer_id,
      price,
      listing_id,
      transaction_type,
      payment_status,
      payment_provider,
      payment_method,
      status
    )
    VALUES (
      v_transaction_id,
      COALESCE(v_listing.title, 'Marketplace item'),
      v_seller_id,
      v_buyer_id,
      v_offer.amount,
      v_offer.listing_id,
      'cash_sale',
      'unpaid',
      'payfast',
      'payfast_sandbox',
      'awaiting_payment'
    );
  ELSE
    UPDATE public.transactions
       SET item = COALESCE(v_listing.title, 'Marketplace item'),
           seller_id = v_seller_id,
           buyer_id = v_buyer_id,
           price = v_offer.amount,
           listing_id = v_offer.listing_id,
           transaction_type = 'cash_sale',
           payment_status = 'unpaid',
           payment_provider = 'payfast',
           payment_method = 'payfast_sandbox',
           status = 'awaiting_payment'
     WHERE id = v_transaction_id;
  END IF;

  UPDATE public.offers
     SET status = 'accepted',
         responded_at = now()
   WHERE id::TEXT = p_offer_id;

  UPDATE public.offers
     SET status = 'declined',
         responded_at = now()
   WHERE listing_id::TEXT = v_offer.listing_id::TEXT
     AND id::TEXT <> p_offer_id
     AND status = 'pending';

  offer_id := p_offer_id;
  transaction_id := v_transaction_id;
  listing_title := COALESCE(v_listing.title, 'Marketplace item');
  amount := v_offer.amount;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_cash_offer_for_payment(TEXT) TO authenticated;

COMMIT;
