-- Activity Logs table for audit trail
-- Service-based logging only (no database triggers)
-- Immutable logs with strict metadata limits

-- Drop existing table if it has wrong schema (safe since it should be empty)
DROP TABLE IF EXISTS activity_logs CASCADE;

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_admin_id UUID NOT NULL REFERENCES admin_profiles(id),
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Enforce metadata size limit (approximately 2KB)
    CONSTRAINT metadata_size_limit CHECK (pg_column_size(metadata) <= 2048)
);

-- Performance indexes
CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_admin_id);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_actor_date ON activity_logs(actor_admin_id, created_at DESC);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs (read-only)
CREATE POLICY "Admins can view all activity logs"
    ON activity_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Admins can insert activity logs
CREATE POLICY "Admins can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- No UPDATE policy (logs are immutable)
-- No DELETE policy (logs are immutable)

-- Comment on table for documentation
COMMENT ON TABLE activity_logs IS 'Immutable audit trail for all admin actions. Logs are created via service layer only.';

-- Comment on columns
COMMENT ON COLUMN activity_logs.action_type IS 'Action types: landlord_created, landlord_updated, landlord_csv_import, charge_bulk_created, payment_logged, payment_confirmed, receipt_generated, receipt_sent_email, receipt_sent_whatsapp, onboarding_task_completed, celebration_approved, celebration_sent, celebration_skipped, admin_login';
COMMENT ON COLUMN activity_logs.entity_type IS 'Entity types: landlord, payment, receipt, celebration, onboarding_task, admin, charge';
COMMENT ON COLUMN activity_logs.metadata IS 'Flat JSON only. Max 2KB. No nested arrays or objects. No PII beyond IDs.';

