BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS trade_meetup_id TEXT,
  ADD COLUMN IF NOT EXISTS trade_meetup_proposed_by UUID;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

UPDATE public.transactions
SET status = 'awaiting_meetup'
WHERE lower(btrim(COALESCE(status, ''))) IN ('awaiting meetup', 'awaiting_meetup');

UPDATE public.transactions
SET status = 'awaiting_meetup'
WHERE transaction_type = 'item_trade'
  AND COALESCE(status, '') IN (
    'pending',
    'awaiting_dropoff',
    'item_received',
    'collection_pending_approval',
    'awaiting_collection'
  );

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
      'awaiting_meetup'
    )
  );

DROP FUNCTION IF EXISTS public.book_trade_meetup_slot(TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.confirm_trade_meetup_slot(TEXT);
DROP FUNCTION IF EXISTS public.decline_trade_meetup_slot(TEXT);

CREATE OR REPLACE FUNCTION public.book_trade_meetup_slot(
  p_transaction_id TEXT,
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
  v_existing_booking public.bookings%ROWTYPE;
  v_facility RECORD;
  v_active_booking_count INTEGER;
  v_booking_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a meetup slot.';
  END IF;

  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'A valid transaction is required.';
  END IF;

  IF p_facility_id IS NULL OR btrim(p_facility_id) = '' THEN
    RAISE EXCEPTION 'Please choose a facility before booking.';
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

  IF COALESCE(v_transaction.transaction_type, '') <> 'item_trade' THEN
    RAISE EXCEPTION 'Only item trades use shared meetup bookings.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_transaction.seller_id
     AND auth.uid() IS DISTINCT FROM v_transaction.buyer_id THEN
    RAISE EXCEPTION 'Only the seller or buyer can book this meetup slot.';
  END IF;

  IF COALESCE(v_transaction.status, '') <> 'awaiting_meetup' THEN
    RAISE EXCEPTION 'This transaction is not awaiting a meetup slot.';
  END IF;

  SELECT id, name, capacity, status
  INTO v_facility
  FROM public.facilities
  WHERE id::TEXT = p_facility_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected facility could not be found.';
  END IF;

  IF COALESCE(v_facility.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'The selected facility is not accepting bookings right now.';
  END IF;

  IF COALESCE(v_facility.capacity, 0) < 1 THEN
    RAISE EXCEPTION 'The selected facility is currently unavailable.';
  END IF;

  IF NULLIF(v_transaction.trade_meetup_id, '') IS NOT NULL THEN
    SELECT *
    INTO v_existing_booking
    FROM public.bookings
    WHERE id = v_transaction.trade_meetup_id
    FOR UPDATE;

    IF FOUND AND COALESCE(v_existing_booking.status, '') = 'scheduled' THEN
      RAISE EXCEPTION 'This meetup slot has already been accepted.';
    END IF;

    IF FOUND
       AND v_transaction.trade_meetup_proposed_by IS NOT NULL
       AND v_transaction.trade_meetup_proposed_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'The other student must accept this slot or request a different one first.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_facility.name || '|' || to_char(p_scheduled_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
      0
    )
  );

  SELECT COUNT(*)
  INTO v_active_booking_count
  FROM public.bookings b
  WHERE b.location = v_facility.name
    AND b.scheduled_time = p_scheduled_time
    AND COALESCE(b.status, 'scheduled') <> 'cancelled'
    AND (v_existing_booking.id IS NULL OR b.id <> v_existing_booking.id);

  IF v_active_booking_count >= v_facility.capacity THEN
    RAISE EXCEPTION 'This slot is no longer available. Please choose another time.';
  END IF;

  IF v_existing_booking.id IS NOT NULL THEN
    UPDATE public.bookings
    SET
      scheduled_time = p_scheduled_time,
      location = v_facility.name,
      type = 'trade_meetup',
      status = 'pending_approval'
    WHERE id = v_existing_booking.id
    RETURNING id INTO v_booking_id;
  ELSE
    v_booking_id := 'MT-' || UPPER(SUBSTRING(md5(clock_timestamp()::TEXT || random()::TEXT || p_transaction_id), 1, 10));

    INSERT INTO public.bookings (
      id,
      type,
      scheduled_time,
      location,
      status
    )
    VALUES (
      v_booking_id,
      'trade_meetup',
      p_scheduled_time,
      v_facility.name,
      'pending_approval'
    );
  END IF;

  UPDATE public.transactions
  SET
    trade_meetup_id = v_booking_id,
    trade_meetup_proposed_by = auth.uid(),
    status = 'awaiting_meetup'
  WHERE id = v_transaction.id;

  RETURN QUERY
  SELECT
    v_booking_id,
    v_facility.name,
    p_scheduled_time,
    'pending_approval'::TEXT,
    'awaiting_meetup'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_trade_meetup_slot(p_transaction_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to confirm a meetup slot.';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This transaction could not be found.';
  END IF;

  IF COALESCE(v_transaction.transaction_type, '') <> 'item_trade'
     OR COALESCE(v_transaction.status, '') <> 'awaiting_meetup' THEN
    RAISE EXCEPTION 'This transaction is not awaiting a meetup slot.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_transaction.seller_id
     AND auth.uid() IS DISTINCT FROM v_transaction.buyer_id THEN
    RAISE EXCEPTION 'Only the seller or buyer can confirm this meetup slot.';
  END IF;

  IF v_transaction.trade_meetup_proposed_by IS NULL THEN
    RAISE EXCEPTION 'No meetup slot has been proposed yet.';
  END IF;

  IF v_transaction.trade_meetup_proposed_by IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The other student must accept the proposed meetup slot.';
  END IF;

  UPDATE public.bookings
  SET status = 'scheduled'
  WHERE id = v_transaction.trade_meetup_id
    AND type = 'trade_meetup'
    AND COALESCE(status, '') <> 'cancelled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The proposed meetup slot could not be found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_trade_meetup_slot(p_transaction_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to request a different meetup slot.';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This transaction could not be found.';
  END IF;

  IF COALESCE(v_transaction.transaction_type, '') <> 'item_trade'
     OR COALESCE(v_transaction.status, '') <> 'awaiting_meetup' THEN
    RAISE EXCEPTION 'This transaction is not awaiting a meetup slot.';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_transaction.seller_id
     AND auth.uid() IS DISTINCT FROM v_transaction.buyer_id THEN
    RAISE EXCEPTION 'Only the seller or buyer can request a different meetup slot.';
  END IF;

  IF NULLIF(v_transaction.trade_meetup_id, '') IS NOT NULL THEN
    UPDATE public.bookings
    SET status = 'cancelled'
    WHERE id = v_transaction.trade_meetup_id
      AND type = 'trade_meetup'
      AND COALESCE(status, '') <> 'scheduled';
  END IF;

  UPDATE public.transactions
  SET
    trade_meetup_id = NULL,
    trade_meetup_proposed_by = NULL,
    status = 'awaiting_meetup'
  WHERE id = v_transaction.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_trade_meetup_slot(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_trade_meetup_slot(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_trade_meetup_slot(TEXT) TO authenticated;

COMMIT;
