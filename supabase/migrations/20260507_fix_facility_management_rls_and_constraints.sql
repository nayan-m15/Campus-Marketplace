-- Production hardening for facilities management.
-- Fixes admin write access, keeps authenticated read access,
-- and adds baseline numeric constraints for facility data.

BEGIN;

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_hours ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facilities_capacity_positive'
      AND conrelid = 'public.facilities'::regclass
  ) THEN
    ALTER TABLE public.facilities
      ADD CONSTRAINT facilities_capacity_positive
      CHECK (capacity >= 1) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'facilities_session_duration_valid'
      AND conrelid = 'public.facilities'::regclass
  ) THEN
    ALTER TABLE public.facilities
      ADD CONSTRAINT facilities_session_duration_valid
      CHECK (session_duration_minutes >= 15 AND session_duration_minutes <= 480) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

DROP POLICY IF EXISTS "facilities_select_authenticated" ON public.facilities;
CREATE POLICY "facilities_select_authenticated"
ON public.facilities
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "facilities_insert_admin" ON public.facilities;
CREATE POLICY "facilities_insert_admin"
ON public.facilities
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "facilities_update_admin" ON public.facilities;
CREATE POLICY "facilities_update_admin"
ON public.facilities
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "facilities_delete_admin" ON public.facilities;
CREATE POLICY "facilities_delete_admin"
ON public.facilities
FOR DELETE
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "facility_hours_select_authenticated" ON public.facility_hours;
CREATE POLICY "facility_hours_select_authenticated"
ON public.facility_hours
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "facility_hours_insert_admin" ON public.facility_hours;
CREATE POLICY "facility_hours_insert_admin"
ON public.facility_hours
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "facility_hours_update_admin" ON public.facility_hours;
CREATE POLICY "facility_hours_update_admin"
ON public.facility_hours
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "facility_hours_delete_admin" ON public.facility_hours;
CREATE POLICY "facility_hours_delete_admin"
ON public.facility_hours
FOR DELETE
TO authenticated
USING (public.is_admin_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_hours TO authenticated;

COMMIT;
