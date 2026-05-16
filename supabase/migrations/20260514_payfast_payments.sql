-- Source: 20260514000100_add_payfast_sandbox_payments.sql
BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payfast_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payfast_payment_reference TEXT;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_payment_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded'));

UPDATE public.transactions
SET payment_status = CASE
  WHEN transaction_type = 'item_trade' THEN 'unpaid'
  WHEN status IN ('awaiting_dropoff', 'item_received', 'awaiting_collection', 'item_released', 'completed') THEN 'paid'
  ELSE COALESCE(payment_status, 'unpaid')
END
WHERE payment_status IS NULL
   OR payment_status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_transactions_payment_status
ON public.transactions (payment_status);

CREATE INDEX IF NOT EXISTS idx_transactions_payfast_reference
ON public.transactions (payfast_payment_reference);

COMMIT;



-- Source: 20260514000200_allow_awaiting_payment_transaction_status.sql
BEGIN;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

UPDATE public.transactions
SET status = CASE
  WHEN status IS NULL OR btrim(status) = '' THEN 'pending'
  WHEN lower(btrim(status)) IN ('awaiting meetup', 'awaiting_meetup') THEN 'Awaiting Meetup'
  WHEN lower(btrim(status)) IN ('dropped_off', 'dropped off') THEN 'item_received'
  WHEN lower(btrim(status)) IN ('collection pending approval') THEN 'collection_pending_approval'
  WHEN lower(btrim(status)) IN ('item released') THEN 'item_released'
  WHEN lower(btrim(status)) IN ('awaiting dropoff', 'awaiting drop-off') THEN 'awaiting_dropoff'
  WHEN lower(btrim(status)) IN ('awaiting payment') THEN 'awaiting_payment'
  ELSE btrim(status)
END;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'awaiting_dropoff',
      'item_received',
      'collection_pending_approval',
      'awaiting_collection',
      'item_released',
      'completed',
      'cancelled',
      'Awaiting Meetup'
    )
  );

COMMIT;



-- Source: 20260514000300_add_cash_offer_payment_accept_rpc.sql
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
      'awaiting_dropoff'
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
           status = 'awaiting_dropoff'
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



