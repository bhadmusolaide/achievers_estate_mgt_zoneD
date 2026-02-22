-- Migration: Add notification_preferences column to admin_profiles
-- Date: 2026-02-22
-- Purpose: Store notification preferences for each admin user

-- Add notification_preferences column to admin_profiles
-- Using JSONB for flexibility in adding more notification types in the future
ALTER TABLE admin_profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_new_payments": true,
  "email_payment_confirmations": true,
  "email_celebration_reminders": true,
  "dashboard_alerts": true
}'::jsonb;

-- Update existing admin profiles with default notification preferences
UPDATE admin_profiles
SET notification_preferences = '{
  "email_new_payments": true,
  "email_payment_confirmations": true,
  "email_celebration_reminders": true,
  "dashboard_alerts": true
}'::jsonb
WHERE notification_preferences IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN admin_profiles.notification_preferences IS 'JSON object storing notification preferences for each admin. Controls email notifications and dashboard alerts.';

-- Create an index on notification_preferences for potential filtering
CREATE INDEX IF NOT EXISTS idx_admin_profiles_notification_preferences 
ON admin_profiles USING GIN (notification_preferences);

