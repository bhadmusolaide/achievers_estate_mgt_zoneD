-- Revert the problematic policy that caused infinite recursion
-- This reverts the changes made in 20260124_fix_admin_profiles_view_policy.sql

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view own profile or chairman can view all" ON admin_profiles;

-- Restore the original working policy that only allows users to view their own profile
CREATE POLICY "Users can view own profile"
    ON admin_profiles FOR SELECT
    USING (auth.uid() = id);

-- Optionally, recreate the original "Chairman can manage profiles" policy if it existed
-- This is the original policy from the schema file that should work without recursion
CREATE POLICY "Chairman can manage profiles"
    ON admin_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles
            WHERE id = auth.uid() AND role = 'chairman'
        )
    );