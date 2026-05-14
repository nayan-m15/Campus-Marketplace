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
