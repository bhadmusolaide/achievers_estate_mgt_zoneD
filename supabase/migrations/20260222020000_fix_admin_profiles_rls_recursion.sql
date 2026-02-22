-- Migration: Fix admin_profiles RLS infinite recursion
-- Date: 2026-02-22
-- Purpose: Fix the infinite recursion error when RLS is enabled on admin_profiles
--
-- Problem: RLS policies on admin_profiles reference admin_profiles itself, causing infinite recursion.
-- When checking "Chairman can manage profiles", it queries admin_profiles which triggers RLS again.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to check the user's role.

-- Step 1: Drop ALL existing policies on admin_profiles to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Users can view own profile or chairman can view all" ON admin_profiles;
DROP POLICY IF EXISTS "Chairman can manage profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Chairman can view all profiles" ON admin_profiles;

-- Step 2: Create a helper function to check if current user is a chairman
-- This function uses SECURITY DEFINER which runs with the privileges of the function owner (postgres)
-- This allows it to bypass RLS and query admin_profiles directly
DROP FUNCTION IF EXISTS auth_user_role();
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM admin_profiles WHERE id = auth.uid()
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth_user_role() TO authenticated;

-- Step 3: Create a helper function to check if user is an admin (exists in admin_profiles)
DROP FUNCTION IF EXISTS is_admin();
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 4: Create non-recursive RLS policies for admin_profiles

-- Policy 1: Users can view their own profile (simple, no recursion)
CREATE POLICY "Users can view own profile"
    ON admin_profiles FOR SELECT
    USING (auth.uid() = id);

-- Policy 2: Chairman can view all profiles (uses SECURITY DEFINER function to avoid recursion)
CREATE POLICY "Chairman can view all profiles"
    ON admin_profiles FOR SELECT
    USING (auth_user_role() = 'chairman');

-- Policy 3: Chairman can insert profiles (uses SECURITY DEFINER function)
CREATE POLICY "Chairman can insert profiles"
    ON admin_profiles FOR INSERT
    WITH CHECK (auth_user_role() = 'chairman');

-- Policy 4: Chairman can update profiles (uses SECURITY DEFINER function)
CREATE POLICY "Chairman can update profiles"
    ON admin_profiles FOR UPDATE
    USING (auth_user_role() = 'chairman');

-- Policy 5: Chairman can delete profiles (uses SECURITY DEFINER function)
CREATE POLICY "Chairman can delete profiles"
    ON admin_profiles FOR DELETE
    USING (auth_user_role() = 'chairman');

-- Step 5: Update other tables' policies to use the helper function
-- This prevents recursion in policies that check admin_profiles

-- Note: For other tables that use EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
-- We should update them to use is_admin() instead, but those don't cause recursion
-- because they're only checking for existence, not checking role from the same table.

-- Add comment explaining the functions
COMMENT ON FUNCTION auth_user_role() IS 'Returns the role of the currently authenticated user from admin_profiles. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
COMMENT ON FUNCTION is_admin() IS 'Returns true if the currently authenticated user exists in admin_profiles. Uses SECURITY DEFINER to bypass RLS.';

