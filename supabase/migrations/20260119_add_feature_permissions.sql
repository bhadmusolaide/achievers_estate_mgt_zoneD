-- Migration: Add feature permissions to admin_profiles
-- Date: 2026-01-19
-- Purpose: Allow chairman to control which features other admins can access

-- Add feature_permissions column to admin_profiles
-- Using JSONB for flexibility in adding more features in the future
-- Chairman always has full access (enforced in application code)
ALTER TABLE admin_profiles
ADD COLUMN IF NOT EXISTS feature_permissions JSONB DEFAULT '{
  "dashboard": true,
  "landlords": true,
  "onboarding": true,
  "bulk_import": true,
  "payments": true,
  "receipts": true,
  "financial_overview": true,
  "celebrations": true,
  "audit_log": true,
  "settings": true
}'::jsonb;

-- Update existing admin profiles with default permissions (all enabled)
UPDATE admin_profiles
SET feature_permissions = '{
  "dashboard": true,
  "landlords": true,
  "onboarding": true,
  "bulk_import": true,
  "payments": true,
  "receipts": true,
  "financial_overview": true,
  "celebrations": true,
  "audit_log": true,
  "settings": true
}'::jsonb
WHERE feature_permissions IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN admin_profiles.feature_permissions IS 'JSON object storing feature access permissions. Chairman role always has full access. Keys match sidebar navigation items.';

-- Create an index on feature_permissions for potential filtering
CREATE INDEX IF NOT EXISTS idx_admin_profiles_feature_permissions 
ON admin_profiles USING GIN (feature_permissions);

