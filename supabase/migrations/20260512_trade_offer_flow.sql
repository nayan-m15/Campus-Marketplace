-- Source: 20260512000100_add_custom_trade_offer_items.sql
BEGIN;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offered_item_title TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_description TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_condition TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_image_url TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS offered_item_description TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_condition TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_image_url TEXT;

COMMIT;



-- Source: 20260512000200_add_item_trade_offer_flow.sql
BEGIN;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offer_type TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS requested_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS offered_listing_id TEXT;

ALTER TABLE public.offers
  ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_offer_type_check;

UPDATE public.offers
SET
  offer_type = CASE
    WHEN lower(btrim(COALESCE(offer_type, ''))) IN ('item_trade', 'trade', 'swap', 'item_swap', 'barter') THEN 'item_trade'
    ELSE 'cash'
  END,
  requested_listing_id = COALESCE(requested_listing_id, listing_id::TEXT)
WHERE requested_listing_id IS NULL
   OR offer_type IS NULL
   OR lower(btrim(offer_type)) NOT IN ('cash', 'item_trade');

ALTER TABLE public.offers
  ADD CONSTRAINT offers_offer_type_check
  CHECK (offer_type IN ('cash', 'item_trade'));

CREATE INDEX IF NOT EXISTS idx_offers_requested_listing_id
ON public.offers (requested_listing_id);

CREATE INDEX IF NOT EXISTS idx_offers_offered_listing_id
ON public.offers (offered_listing_id);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'cash_sale',
  ADD COLUMN IF NOT EXISTS requested_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS offered_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS requested_item TEXT,
  ADD COLUMN IF NOT EXISTS offered_item TEXT;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

UPDATE public.transactions
SET
  transaction_type = CASE
    WHEN lower(btrim(COALESCE(transaction_type, ''))) IN ('item_trade', 'trade', 'swap', 'item_swap', 'barter') THEN 'item_trade'
    ELSE 'cash_sale'
  END,
  requested_listing_id = COALESCE(requested_listing_id, listing_id::TEXT),
  requested_item = COALESCE(requested_item, item)
WHERE transaction_type IS NULL
   OR requested_listing_id IS NULL
   OR requested_item IS NULL
   OR lower(btrim(transaction_type)) NOT IN ('cash_sale', 'item_trade');

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('cash_sale', 'item_trade'));

CREATE INDEX IF NOT EXISTS idx_transactions_requested_listing_id
ON public.transactions (requested_listing_id);

CREATE INDEX IF NOT EXISTS idx_transactions_offered_listing_id
ON public.transactions (offered_listing_id);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS traded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS traded_transaction_id TEXT;

COMMIT;



-- Source: 20260512000300_add_trade_offer_item_details.sql
BEGIN;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offered_item_title TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_description TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_condition TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_image_url TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS offered_item_description TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_condition TEXT,
  ADD COLUMN IF NOT EXISTS offered_item_image_url TEXT;

COMMIT;



