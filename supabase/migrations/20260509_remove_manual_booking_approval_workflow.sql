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
