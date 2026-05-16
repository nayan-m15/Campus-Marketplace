-- Prevent non-admin users from changing protected profile authorization fields.
-- RLS policies cannot compare OLD and NEW row values, so role/status protection
-- is enforced with a trigger.

BEGIN;

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
      AND COALESCE(status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
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
      AND role = 'staff'
      AND COALESCE(status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff_user()
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
      AND role IN ('admin', 'staff')
      AND COALESCE(status, 'active') = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_non_admin_profile_role_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status
  )
  AND COALESCE(auth.role(), '') <> 'service_role'
  AND NOT public.is_admin_user()
  THEN
    RAISE EXCEPTION 'Only administrators can change profile role or status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_status_update ON public.profiles;
CREATE TRIGGER protect_profile_role_status_update
BEFORE UPDATE OF role, status ON public.profiles
FOR EACH ROW
WHEN (
  NEW.role IS DISTINCT FROM OLD.role
  OR NEW.status IS DISTINCT FROM OLD.status
)
EXECUTE FUNCTION public.prevent_non_admin_profile_role_status_update();

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

COMMENT ON FUNCTION public.prevent_non_admin_profile_role_status_update()
IS 'Rejects non-admin attempts to change protected profile role/status fields.';

COMMIT;
