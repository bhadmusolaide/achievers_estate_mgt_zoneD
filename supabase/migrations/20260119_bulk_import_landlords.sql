-- Migration: Add bulk import support for landlords
-- Date: 2026-01-19

-- Update landlords table for bulk import requirements
ALTER TABLE landlords
ALTER COLUMN house_address DROP NOT NULL,
ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20) DEFAULT 'pending';

-- Change date_of_birth and wedding_anniversary to VARCHAR(5) for MM-DD format
ALTER TABLE landlords
ALTER COLUMN date_of_birth TYPE VARCHAR(5),
ALTER COLUMN wedding_anniversary TYPE VARCHAR(5);

-- Create activity_logs table for logging bulk operations
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    total_rows INTEGER NOT NULL,
    successful_rows INTEGER NOT NULL DEFAULT 0,
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create activity_log_details table for detailed logging (e.g., skipped rows)
CREATE TABLE IF NOT EXISTS activity_log_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_log_id UUID NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
    row_number INTEGER,
    failure_reason TEXT,
    row_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_details_activity ON activity_log_details(activity_log_id);

-- Enable RLS on activity tables
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all activity logs"
    ON activity_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- RLS Policies for activity_log_details
CREATE POLICY "Admins can view all activity log details"
    ON activity_log_details FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert activity log details"
    ON activity_log_details FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));