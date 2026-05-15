-- Source: 20260507000100_enhance_profiles_for_staff_management.sql
-- Migration: Enhance profiles table for comprehensive staff management
-- This migration ensures the profiles table has all necessary fields for staff operations
-- and implements proper Row Level Security (RLS) policies for staff management

BEGIN;

-- Add missing columns to profiles table if they don't exist
DO $$
BEGIN
    -- Add phone_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create trigger to automatically update updated_at timestamp for profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_profiles_updated_at();

-- Enable RLS on profiles table if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create helper functions for role-based access control
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
  );
$$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_staff_user() TO authenticated;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Create RLS policies for profiles table

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admin and staff can view all profiles (for staff management)
CREATE POLICY "profiles_select_admin_staff"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_user() OR public.is_staff_user());

-- Admin can insert new profiles (for creating staff accounts)
CREATE POLICY "profiles_insert_admin"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

-- Admin can update any profile (for staff management)
CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Users can update their own profile (except role and status)
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() AND 
    role IS NOT DISTINCT FROM role AND 
    status IS NOT DISTINCT FROM status
);

-- Admin can delete profiles (for staff management)
CREATE POLICY "profiles_delete_admin"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin_user());

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Add comments to document the new fields
COMMENT ON COLUMN public.profiles.phone_number IS 'Optional phone number for staff members';
COMMENT ON COLUMN public.profiles.status IS 'Account status (active/inactive) for staff management';
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when the profile was created';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp when the profile was last updated';

-- Create an index on role for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Create an index on status for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Create an index on created_at for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

COMMIT;



-- Source: 20260507000200_fix_facility_management_rls_and_constraints.sql
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



-- Source: 20260507000300_add_facility_hours_unique_constraint.sql
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



