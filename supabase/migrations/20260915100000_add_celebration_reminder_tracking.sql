-- Migration: Add celebration reminder tracking to admin_profiles
-- Date: 2026-09-15

-- Add column to track when the last celebration reminder email was sent to each admin
ALTER TABLE admin_profiles
ADD COLUMN IF NOT EXISTS celebration_reminder_last_sent TIMESTAMP WITH TIME ZONE;
