-- Fix RLS policy to allow chairman to view all admin profiles
-- This resolves the issue where newly created admin users don't appear in the UI

-- Drop the existing "Users can view own profile" policy
DROP POLICY IF EXISTS "Users can view own profile" ON admin_profiles;

-- Create a new policy that allows:
-- 1. Users to view their own profile
-- 2. Chairman to view all admin profiles
CREATE POLICY "Users can view own profile or chairman can view all"
    ON admin_profiles FOR SELECT
    USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM admin_profiles
            WHERE id = auth.uid() AND role = 'chairman'
        )
    );
