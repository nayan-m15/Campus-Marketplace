-- Source: 20260509000100_add_atomic_transaction_slot_booking.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  type TEXT,
  scheduled_time TIMESTAMPTZ,
  location TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  item TEXT,
  seller_id UUID,
  buyer_id UUID,
  price NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  dropoff_id TEXT,
  collection_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS item TEXT,
  ADD COLUMN IF NOT EXISTS seller_id UUID,
  ADD COLUMN IF NOT EXISTS buyer_id UUID,
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dropoff_id TEXT,
  ADD COLUMN IF NOT EXISTS collection_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bookings_location_scheduled_status
ON public.bookings (location, scheduled_time, status);

UPDATE public.bookings
SET status = 'scheduled'
WHERE status = 'pending_approval'
  AND type IN ('dropoff', 'collection');

UPDATE public.transactions t
SET status = 'awaiting_collection'
FROM public.bookings b
WHERE t.collection_id = b.id
  AND b.type = 'collection'
  AND b.status = 'scheduled'
  AND t.status IN ('item_received', 'collection_pending_approval');

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
  v_facility RECORD;
  v_active_booking_count INTEGER;
  v_booking_id TEXT;
  v_next_transaction_status TEXT;
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

  IF p_booking_type = 'dropoff' THEN
    IF v_transaction.seller_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the seller can book the drop-off slot for this transaction.';
    END IF;

    IF COALESCE(v_transaction.status, '') NOT IN ('pending', 'awaiting_dropoff') THEN
      RAISE EXCEPTION 'This transaction is not ready for a drop-off booking.';
    END IF;

    v_existing_booking_id := NULLIF(v_transaction.dropoff_id, '');
    v_next_transaction_status := 'awaiting_dropoff';
  ELSE
    IF v_transaction.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the buyer can book the collection slot for this transaction.';
    END IF;

    IF COALESCE(v_transaction.status, '') NOT IN ('item_received', 'collection_pending_approval', 'awaiting_collection') THEN
      RAISE EXCEPTION 'Collection cannot be booked until the seller drop-off has been completed.';
    END IF;

    v_existing_booking_id := NULLIF(v_transaction.collection_id, '');
    v_next_transaction_status := 'awaiting_collection';
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

COMMIT;



-- Source: 20260509000200_remove_manual_booking_approval_workflow.sql
BEGIN;

UPDATE public.bookings
SET status = 'scheduled'
WHERE status = 'pending_approval'
  AND type IN ('dropoff', 'collection');

UPDATE public.transactions t
SET status = CASE
  WHEN t.dropoff_id IS NOT NULL AND t.collection_id IS NULL THEN 'awaiting_dropoff'
  WHEN t.collection_id IS NOT NULL THEN 'awaiting_collection'
  ELSE t.status
END
WHERE t.status IN ('pending', 'collection_pending_approval')
  AND (
    t.dropoff_id IS NOT NULL
    OR t.collection_id IS NOT NULL
  );

COMMIT;



