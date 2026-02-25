-- Zone-D Landlord Management App Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin Profiles table (extends Supabase Auth)
CREATE TABLE admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('chairman', 'secretary', 'treasurer', 'officer')),
    zone VARCHAR(50) DEFAULT 'Zone D',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Landlords table
CREATE TABLE landlords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    house_address VARCHAR(255) NOT NULL,
    road VARCHAR(50),
    zone VARCHAR(50) DEFAULT 'Zone D',
    occupancy_type VARCHAR(20) NOT NULL CHECK (occupancy_type IN ('owner', 'tenant')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    date_of_birth DATE,
    wedding_anniversary DATE,
    celebrate_opt_in BOOLEAN DEFAULT FALSE,
    onboarding_status VARCHAR(20) DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'active')),
    onboarding_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    onboarding_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for landlords
CREATE INDEX idx_landlords_phone ON landlords(phone);
CREATE INDEX idx_landlords_house_address ON landlords(house_address);
CREATE INDEX idx_landlords_road ON landlords(road);
CREATE INDEX idx_landlords_zone ON landlords(zone);
CREATE INDEX idx_landlords_celebrate_opt_in ON landlords(celebrate_opt_in) WHERE celebrate_opt_in = TRUE;
CREATE INDEX idx_landlords_onboarding_status ON landlords(onboarding_status);

-- Payment Types table (seeded)
CREATE TABLE payment_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed payment types
INSERT INTO payment_types (name, description) VALUES
    ('dues', 'Monthly Estate Dues'),
    ('levy', 'Special Levy'),
    ('security', 'Security Contribution'),
    ('project', 'Project Contribution');

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE RESTRICT,
    payment_type_id UUID NOT NULL REFERENCES payment_types(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash')),
    installment BOOLEAN DEFAULT FALSE,
    installment_stage VARCHAR(20) CHECK (installment_stage IN ('first', 'second', 'final') OR installment_stage IS NULL),
    payment_month INTEGER NOT NULL CHECK (payment_month BETWEEN 1 AND 12),
    payment_year INTEGER NOT NULL CHECK (payment_year >= 2020),
    reference_code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
    logged_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_payment_per_period UNIQUE (landlord_id, payment_type_id, payment_month, payment_year)
);

-- Indexes for payments
CREATE INDEX idx_payments_landlord ON payments(landlord_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_period ON payments(payment_year, payment_month);

-- Receipts table
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID UNIQUE NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    pdf_url TEXT,
    sent_email BOOLEAN DEFAULT FALSE,
    sent_whatsapp BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for receipts
CREATE INDEX idx_receipts_payment ON receipts(payment_id);

-- Celebrations Queue table (birthday and anniversary tracking)
CREATE TABLE celebrations_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    celebration_type VARCHAR(20) NOT NULL CHECK (celebration_type IN ('birthday', 'anniversary')),
    celebration_date DATE NOT NULL,
    days_to_event INTEGER NOT NULL CHECK (days_to_event >= 0 AND days_to_event <= 3),
    year INTEGER NOT NULL CHECK (year >= 2020),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'skipped')),
    custom_message TEXT,
    approved_by UUID REFERENCES admin_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_via VARCHAR(20) CHECK (sent_via IN ('whatsapp', 'email') OR sent_via IS NULL),
    skipped_at TIMESTAMP WITH TIME ZONE,
    skipped_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_celebration_per_year UNIQUE (landlord_id, celebration_type, celebration_date, year)
);

-- Indexes for celebrations_queue
CREATE INDEX idx_celebrations_type ON celebrations_queue(celebration_type);
CREATE INDEX idx_celebrations_date ON celebrations_queue(celebration_date);
CREATE INDEX idx_celebrations_status ON celebrations_queue(status);
CREATE INDEX idx_celebrations_landlord ON celebrations_queue(landlord_id);
CREATE INDEX idx_celebrations_days_to_event ON celebrations_queue(days_to_event);

-- Celebration Message Templates table
CREATE TABLE celebration_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    celebration_type VARCHAR(20) NOT NULL CHECK (celebration_type IN ('birthday', 'anniversary')),
    template_name VARCHAR(100) NOT NULL,
    message_template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default celebration templates
INSERT INTO celebration_templates (celebration_type, template_name, message_template, is_default) VALUES
    ('birthday', 'Default Birthday', 'Dear {landlord_name},

Wishing you a very Happy Birthday! 🎂🎉

On behalf of {estate_name}, we celebrate you today and wish you many more years of good health, prosperity, and happiness.

May this special day bring you joy and wonderful memories.

Warm regards,
{chairman_name}
Zone-D Estate Management', TRUE),
    ('anniversary', 'Default Anniversary', 'Dear {landlord_name},

Happy Wedding Anniversary! 💍❤️

On behalf of {estate_name}, we celebrate the beautiful journey of love and partnership you share with your spouse.

May your union continue to be blessed with love, understanding, and many more wonderful years together.

Warm regards,
{chairman_name}
Zone-D Estate Management', TRUE);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebrations_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_templates ENABLE ROW LEVEL SECURITY;

-- Admin profiles policies
-- Allow users to view their own profile (no circular dependency)
CREATE POLICY "Users can view own profile"
    ON admin_profiles FOR SELECT
    USING (auth.uid() = id);

-- Allow chairman to manage all profiles (after they have a profile)
CREATE POLICY "Chairman can manage profiles"
    ON admin_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles
            WHERE id = auth.uid() AND role = 'chairman'
        )
    );

-- Landlords policies
CREATE POLICY "Admins can view all landlords"
    ON landlords FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert landlords"
    ON landlords FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update landlords"
    ON landlords FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Payment types policies
CREATE POLICY "Admins can view payment types"
    ON payment_types FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Payments policies
CREATE POLICY "Admins can view all payments"
    ON payments FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert payments"
    ON payments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update pending payments"
    ON payments FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()) AND status = 'pending');

-- Receipts policies
CREATE POLICY "Admins can view all receipts"
    ON receipts FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert receipts"
    ON receipts FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update receipts"
    ON receipts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Admins can upload receipts"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'receipts' AND
        EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can view receipts"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'receipts' AND
        EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
    );

-- Celebrations queue policies
CREATE POLICY "Admins can view all celebrations"
    ON celebrations_queue FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert celebrations"
    ON celebrations_queue FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update celebrations"
    ON celebrations_queue FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Celebration templates policies
CREATE POLICY "Admins can view all templates"
    ON celebration_templates FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage templates"
    ON celebration_templates FOR ALL
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- ONBOARDING TABLES
-- ===========================================

-- Onboarding Tasks table
CREATE TABLE onboarding_tasks (
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
CREATE INDEX idx_onboarding_tasks_landlord ON onboarding_tasks(landlord_id);
CREATE INDEX idx_onboarding_tasks_key ON onboarding_tasks(task_key);
CREATE INDEX idx_onboarding_tasks_completed ON onboarding_tasks(completed);

-- Onboarding Activity Log table
CREATE TABLE onboarding_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admin_profiles(id),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    task_key VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for onboarding_activity_log
CREATE INDEX idx_onboarding_activity_landlord ON onboarding_activity_log(landlord_id);
CREATE INDEX idx_onboarding_activity_admin ON onboarding_activity_log(admin_id);
CREATE INDEX idx_onboarding_activity_action ON onboarding_activity_log(action_type);

-- Enable RLS for onboarding tables
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_activity_log ENABLE ROW LEVEL SECURITY;

-- Onboarding tasks policies
CREATE POLICY "Admins can view all onboarding tasks"
    ON onboarding_tasks FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert onboarding tasks"
    ON onboarding_tasks FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update onboarding tasks"
    ON onboarding_tasks FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- Onboarding activity log policies
CREATE POLICY "Admins can view onboarding activity"
    ON onboarding_activity_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert onboarding activity"
    ON onboarding_activity_log FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- ACTIVITY LOGS (AUDIT TRAIL)
-- ===========================================

-- Activity Logs table for audit trail
-- Service-based logging only (no database triggers)
-- Immutable logs with strict metadata limits
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

-- No UPDATE or DELETE policies (logs are immutable)

COMMENT ON TABLE activity_logs IS 'Immutable audit trail for all admin actions. Logs are created via service layer only.';
COMMENT ON COLUMN activity_logs.action_type IS 'Action types: landlord_created, landlord_updated, landlord_csv_import, charge_bulk_created, payment_logged, payment_confirmed, receipt_generated, receipt_sent_email, receipt_sent_whatsapp, onboarding_task_completed, celebration_approved, celebration_sent, celebration_skipped, admin_login';
COMMENT ON COLUMN activity_logs.entity_type IS 'Entity types: landlord, payment, receipt, celebration, onboarding_task, admin, charge';
COMMENT ON COLUMN activity_logs.metadata IS 'Flat JSON only. Max 2KB. No nested arrays or objects. No PII beyond IDs.';
