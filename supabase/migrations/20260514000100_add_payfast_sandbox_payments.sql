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
