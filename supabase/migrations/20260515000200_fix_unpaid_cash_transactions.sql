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
