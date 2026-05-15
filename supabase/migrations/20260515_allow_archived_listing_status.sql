BEGIN;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

UPDATE public.listings
SET status = CASE
  WHEN status IS NULL OR btrim(status) = '' THEN 'active'
  ELSE btrim(status)
END;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (
    status IN (
      'active',
      'sold',
      'flagged',
      'for_trade',
      'traded',
      'archived'
    )
  );

COMMIT;
