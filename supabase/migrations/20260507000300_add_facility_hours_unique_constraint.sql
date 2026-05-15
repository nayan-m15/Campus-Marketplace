-- Ensure facility_hours supports ON CONFLICT (facility_id, day) safely.
-- This migration removes duplicate rows first, keeping the newest record
-- for each facility/day pair, then adds the required unique constraint.

BEGIN;

WITH ranked_facility_hours AS (
  SELECT
    id,
    facility_id,
    day,
    ROW_NUMBER() OVER (
      PARTITION BY facility_id, day
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_rank
  FROM public.facility_hours
),
deleted_duplicates AS (
  DELETE FROM public.facility_hours fh
  USING ranked_facility_hours ranked
  WHERE fh.id = ranked.id
    AND ranked.row_rank > 1
  RETURNING fh.id, fh.facility_id, fh.day
)
SELECT COUNT(*) AS removed_duplicate_rows
FROM deleted_duplicates;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facility_hours_facility_day_unique'
      AND conrelid = 'public.facility_hours'::regclass
  ) THEN
    ALTER TABLE public.facility_hours
      ADD CONSTRAINT facility_hours_facility_day_unique
      UNIQUE (facility_id, day);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facility_hours_facility_day
ON public.facility_hours (facility_id, day);

COMMIT;
