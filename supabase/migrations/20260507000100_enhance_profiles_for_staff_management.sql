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
