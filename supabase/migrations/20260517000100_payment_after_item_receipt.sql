BEGIN;

UPDATE public.transactions
SET status = 'awaiting_dropoff'
WHERE status = 'awaiting_payment'
  AND COALESCE(transaction_type, '') <> 'item_trade'
  AND COALESCE(payment_status, 'unpaid') <> 'paid'
  AND NULLIF(dropoff_id, '') IS NULL;

CREATE OR REPLACE FUNCTION public.prevent_unpaid_sale_collection()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.transaction_type, '') <> 'item_trade'
     AND NEW.offered_listing_id IS NULL
     AND NEW.status IN ('collection_pending_approval', 'awaiting_collection')
     AND COALESCE(NEW.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Buyer payment must be confirmed before collection can be booked.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unpaid_sale_collection_trigger ON public.transactions;
CREATE TRIGGER prevent_unpaid_sale_collection_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unpaid_sale_collection();

CREATE OR REPLACE FUNCTION public.book_transaction_slot(
  p_transaction_id TEXT,
  p_booking_type TEXT,
  p_facility_id TEXT,
  p_scheduled_time TIMESTAMPTZ
)
RETURNS TABLE (
  booking_id TEXT,
  location TEXT,
  scheduled_time TIMESTAMPTZ,
  booking_status TEXT,
  transaction_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
  v_existing_booking_id TEXT;
  v_existing_booking public.bookings%ROWTYPE;
  v_dropoff_booking public.bookings%ROWTYPE;
  v_facility RECORD;
  v_active_booking_count INTEGER;
  v_booking_id TEXT;
  v_next_transaction_status TEXT;
  v_is_sale_collection BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a facility slot.';
  END IF;

  IF p_booking_type NOT IN ('dropoff', 'collection') THEN
    RAISE EXCEPTION 'Invalid booking type.';
  END IF;

  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'A valid transaction is required.';
  END IF;

  IF p_scheduled_time IS NULL THEN
    RAISE EXCEPTION 'Please choose a valid date and time.';
  END IF;

  IF p_scheduled_time <= NOW() THEN
    RAISE EXCEPTION 'Bookings must be scheduled for a future time.';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This transaction could not be found.';
  END IF;

  IF p_booking_type = 'dropoff' THEN
    IF p_facility_id IS NULL OR btrim(p_facility_id) = '' THEN
      RAISE EXCEPTION 'Please choose a facility before booking.';
    END IF;

    IF v_transaction.seller_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the seller can book the drop-off slot for this transaction.';
    END IF;

    IF COALESCE(v_transaction.status, '') NOT IN ('pending', 'awaiting_payment', 'awaiting_dropoff') THEN
      RAISE EXCEPTION 'This transaction is not ready for a drop-off booking.';
    END IF;

    v_existing_booking_id := NULLIF(v_transaction.dropoff_id, '');
    v_next_transaction_status := 'awaiting_dropoff';

    SELECT id, name, capacity, status
    INTO v_facility
    FROM public.facilities
    WHERE id::TEXT = p_facility_id;
  ELSE
    IF v_transaction.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the buyer can book the collection slot for this transaction.';
    END IF;

    IF COALESCE(v_transaction.status, '') NOT IN ('item_received', 'collection_pending_approval', 'awaiting_collection')
       AND NOT (
         COALESCE(v_transaction.status, '') = 'awaiting_dropoff'
         AND COALESCE(v_transaction.payment_status, '') = 'paid'
         AND NULLIF(v_transaction.dropoff_id, '') IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'Collection cannot be booked until the seller drop-off has been completed.';
    END IF;

    v_existing_booking_id := NULLIF(v_transaction.collection_id, '');
    v_next_transaction_status := 'awaiting_collection';
    v_is_sale_collection := COALESCE(v_transaction.transaction_type, '') <> 'item_trade'
      AND v_transaction.offered_listing_id IS NULL;

    IF v_is_sale_collection THEN
      IF NULLIF(v_transaction.dropoff_id, '') IS NULL THEN
        RAISE EXCEPTION 'Collection cannot be booked until the seller drop-off facility is recorded.';
      END IF;

      SELECT *
      INTO v_dropoff_booking
      FROM public.bookings
      WHERE id = v_transaction.dropoff_id
        AND type = 'dropoff';

      IF NOT FOUND OR NULLIF(v_dropoff_booking.location, '') IS NULL THEN
        RAISE EXCEPTION 'Collection cannot be booked until the seller drop-off facility is recorded.';
      END IF;

      SELECT id, name, capacity, status
      INTO v_facility
      FROM public.facilities
      WHERE name = v_dropoff_booking.location;
    ELSE
      IF p_facility_id IS NULL OR btrim(p_facility_id) = '' THEN
        RAISE EXCEPTION 'Please choose a facility before booking.';
      END IF;

      SELECT id, name, capacity, status
      INTO v_facility
      FROM public.facilities
      WHERE id::TEXT = p_facility_id;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected facility could not be found.';
  END IF;

  IF COALESCE(v_facility.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'The selected facility is not accepting bookings right now.';
  END IF;

  IF COALESCE(v_facility.capacity, 0) < 1 THEN
    RAISE EXCEPTION 'The selected facility is currently unavailable.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_facility.name || '|' || to_char(p_scheduled_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
      0
    )
  );

  IF v_existing_booking_id IS NOT NULL THEN
    SELECT *
    INTO v_existing_booking
    FROM public.bookings
    WHERE id = v_existing_booking_id
    FOR UPDATE;
  END IF;

  SELECT COUNT(*)
  INTO v_active_booking_count
  FROM public.bookings b
  WHERE b.location = v_facility.name
    AND b.scheduled_time = p_scheduled_time
    AND COALESCE(b.status, 'scheduled') <> 'cancelled'
    AND (v_existing_booking_id IS NULL OR b.id <> v_existing_booking_id);

  IF v_active_booking_count >= v_facility.capacity THEN
    RAISE EXCEPTION 'This slot is no longer available. Please choose another time.';
  END IF;

  IF v_existing_booking.id IS NOT NULL THEN
    UPDATE public.bookings
    SET
      scheduled_time = p_scheduled_time,
      location = v_facility.name,
      type = p_booking_type,
      status = 'scheduled'
    WHERE id = v_existing_booking.id
    RETURNING id INTO v_booking_id;
  ELSE
    v_booking_id := (
      CASE WHEN p_booking_type = 'dropoff' THEN 'DO-' ELSE 'CL-' END ||
      UPPER(SUBSTRING(md5(clock_timestamp()::TEXT || random()::TEXT || p_transaction_id || p_booking_type), 1, 10))
    );

    INSERT INTO public.bookings (
      id,
      type,
      scheduled_time,
      location,
      status
    )
    VALUES (
      v_booking_id,
      p_booking_type,
      p_scheduled_time,
      v_facility.name,
      'scheduled'
    );
  END IF;

  IF p_booking_type = 'dropoff' THEN
    UPDATE public.transactions
    SET
      dropoff_id = v_booking_id,
      status = v_next_transaction_status
    WHERE id = v_transaction.id;
  ELSE
    UPDATE public.transactions
    SET
      collection_id = v_booking_id,
      status = v_next_transaction_status
    WHERE id = v_transaction.id;
  END IF;

  RETURN QUERY
  SELECT
    v_booking_id,
    v_facility.name,
    p_scheduled_time,
    'scheduled'::TEXT,
    v_next_transaction_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_transaction_slot(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

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
