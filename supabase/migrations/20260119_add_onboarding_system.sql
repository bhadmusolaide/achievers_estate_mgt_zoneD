-- Migration: Add Landlord Onboarding System
-- Date: 2026-01-19

-- Add onboarding fields to landlords table
ALTER TABLE landlords 
ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for onboarding_status
ALTER TABLE landlords 
ADD CONSTRAINT check_onboarding_status 
CHECK (onboarding_status IN ('pending', 'active'));

-- Set existing landlords as already onboarded (active status)
UPDATE landlords 
SET onboarding_status = 'active',
    onboarding_completed_at = created_at
WHERE onboarding_status IS NULL OR onboarding_status = 'active';

-- Create index for onboarding_status
CREATE INDEX IF NOT EXISTS idx_landlords_onboarding_status ON landlords(onboarding_status);

-- Onboarding Tasks table
CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    task_key VARCHAR(100) NOT NULL,
    task_label VARCHAR(255) NOT NULL,
    required BOOLEAN DEFAULT TRUE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES admin_profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(landlord_id, task_key)
);

-- Indexes for onboarding_tasks
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_landlord ON onboarding_tasks(landlord_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_key ON onboarding_tasks(task_key);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_completed ON onboarding_tasks(completed);

-- Onboarding Activity Log table
CREATE TABLE IF NOT EXISTS onboarding_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_profiles(id),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    task_key VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for onboarding_activity_log
CREATE INDEX IF NOT EXISTS idx_onboarding_activity_landlord ON onboarding_activity_log(landlord_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_activity_admin ON onboarding_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_activity_action ON onboarding_activity_log(action_type);

-- Enable RLS for onboarding tables
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_activity_log ENABLE ROW LEVEL SECURITY;

-- Onboarding tasks policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all onboarding tasks') THEN
        CREATE POLICY "Admins can view all onboarding tasks"
            ON onboarding_tasks FOR SELECT
            USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert onboarding tasks') THEN
        CREATE POLICY "Admins can insert onboarding tasks"
            ON onboarding_tasks FOR INSERT
            WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update onboarding tasks') THEN
        CREATE POLICY "Admins can update onboarding tasks"
            ON onboarding_tasks FOR UPDATE
            USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view onboarding activity') THEN
        CREATE POLICY "Admins can view onboarding activity"
            ON onboarding_activity_log FOR SELECT
            USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert onboarding activity') THEN
        CREATE POLICY "Admins can insert onboarding activity"
            ON onboarding_activity_log FOR INSERT
            WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
    END IF;
END $$;

