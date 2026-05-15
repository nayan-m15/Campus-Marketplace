-- Source: 20260515000100_allow_archived_listing_status.sql
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



-- Source: 20260515000200_fix_unpaid_cash_transactions.sql
BEGIN;

UPDATE public.transactions
SET status = 'awaiting_payment'
WHERE transaction_type = 'cash_sale'
  AND status = 'awaiting_dropoff'
  AND COALESCE(payment_status, 'unpaid') <> 'paid';

UPDATE public.listings AS listing
SET status = 'active',
    sold_price = NULL
FROM public.transactions AS transaction
WHERE transaction.listing_id = listing.id
  AND transaction.transaction_type = 'cash_sale'
  AND transaction.status = 'awaiting_payment'
  AND COALESCE(transaction.payment_status, 'unpaid') <> 'paid'
  AND listing.status = 'sold';

COMMIT;



