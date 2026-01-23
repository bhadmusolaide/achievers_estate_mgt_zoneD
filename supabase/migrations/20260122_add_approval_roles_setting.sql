-- Migration: Add approval_roles setting
-- Date: 2026-01-22
-- Purpose: Add setting for roles that can approve transactions with default value ['chairman', 'treasurer']

-- Insert approval_roles setting with default value as JSON array
INSERT INTO settings (key, value, description)
VALUES ('approval_roles', '["chairman", "treasurer"]', 'Roles authorized to approve transactions as JSON array')
ON CONFLICT (key) DO NOTHING;