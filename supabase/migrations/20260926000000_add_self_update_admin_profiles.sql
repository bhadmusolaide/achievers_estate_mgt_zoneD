-- Migration: Allow admins to update their own profile
-- Date: 2026-09-26
-- Purpose: Allow non-chairman admins to update their own full_name, email, and zone
-- while preventing changes to role.

-- Step 1: Ensure email column exists on admin_profiles
ALTER TABLE admin_profiles
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

COMMENT ON COLUMN admin_profiles.email IS 'Admin email address for notifications and sign-in';

-- Step 2: Policy for users to update own profile (all fields except role is enforced by trigger)
CREATE POLICY "Users can update own profile"
    ON admin_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Step 3: Trigger to prevent role escalation on self-update
CREATE OR REPLACE FUNCTION prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Cannot change your own role. Contact the chairman.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_role_change
    BEFORE UPDATE ON admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_role_change();

COMMENT ON POLICY "Users can update own profile" ON admin_profiles IS 'Allows authenticated admins to update their own profile fields (full_name, email, zone). Role changes are blocked by a separate trigger.';
COMMENT ON FUNCTION prevent_self_role_change() IS 'Prevents admins from changing their own role during profile updates.';