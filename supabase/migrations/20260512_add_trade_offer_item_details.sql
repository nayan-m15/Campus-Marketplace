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
