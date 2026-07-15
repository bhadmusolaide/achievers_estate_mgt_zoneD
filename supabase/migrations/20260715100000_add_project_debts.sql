-- Add project_debts and debt_payments tables for tracking overspend on completed projects

-- ===========================================
-- PROJECT DEBTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS project_debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount > 0),
    remaining_amount DECIMAL(12, 2) NOT NULL CHECK (remaining_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paid')),
    created_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_debts_project ON project_debts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_debts_status ON project_debts(status);

ALTER TABLE project_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all project debts"
    ON project_debts FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert project debts"
    ON project_debts FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update project debts"
    ON project_debts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete project debts"
    ON project_debts FOR DELETE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- DEBT PAYMENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES project_debts(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) CHECK (payment_method IN ('bank_transfer', 'cash')),
    notes TEXT,
    created_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);

ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all debt payments"
    ON debt_payments FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert debt payments"
    ON debt_payments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- ADD DEBT_REPAYMENT TRANSACTION CATEGORY
-- ===========================================
INSERT INTO transaction_categories (name, type, description)
VALUES ('debt_repayment', 'debit', 'Repayment of project debts')
ON CONFLICT (name) DO NOTHING;

-- Fix type if it was previously created as 'credit' in an earlier version of this migration
UPDATE transaction_categories
SET type = 'debit', updated_at = NOW()
WHERE name = 'debt_repayment' AND type = 'credit';