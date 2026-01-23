-- Migration: Add Transactions System
-- Date: 2026-01-23
-- Purpose: Track credit and debit transactions with account balance management

-- Transaction Categories table (configurable by chairman)
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default transaction categories
INSERT INTO transaction_categories (name, type, description) VALUES
    -- Credit categories
    ('rent_income', 'credit', 'Income from landlord payments'),
    ('other_income', 'credit', 'Other miscellaneous income'),
    ('refund', 'credit', 'Refunds received'),
    ('gift', 'credit', 'Gifts received'),
    ('loan', 'credit', 'Loans received'),
    -- Debit categories
    ('maintenance', 'debit', 'Maintenance and repairs'),
    ('utilities', 'debit', 'Utility expenses'),
    ('salaries', 'debit', 'Staff salaries'),
    ('security', 'debit', 'Security services'),
    ('admin_expenses', 'debit', 'Administrative expenses'),
    ('other_expenses', 'debit', 'Other expenses'),
    ('miscellaneous', 'debit', 'Miscellaneous expenses'),
    ('charity', 'debit', 'Charity and donations')
ON CONFLICT (name) DO NOTHING;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    category_id UUID NOT NULL REFERENCES transaction_categories(id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    reference VARCHAR(100),
    landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    account_id UUID, -- For future multi-account support, nullable for now
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES admin_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES admin_profiles(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_by UUID NOT NULL REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_landlord ON transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment ON transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_requires_approval ON transactions(requires_approval) WHERE requires_approval = TRUE;

-- Account Balance table (supports multiple accounts in future)
CREATE TABLE IF NOT EXISTS account_balance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_name VARCHAR(100) NOT NULL DEFAULT 'Main Account',
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    last_transaction_id UUID REFERENCES transactions(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default account balance (single account for now)
INSERT INTO account_balance (id, account_name, balance) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Main Account', 0)
ON CONFLICT (id) DO NOTHING;

-- Settings table for approval threshold (if not exists)
-- We'll add a setting for debit approval threshold
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'settings'
    ) THEN
        CREATE TABLE settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            key VARCHAR(100) NOT NULL UNIQUE,
            value TEXT NOT NULL,
            description TEXT,
            updated_by UUID REFERENCES admin_profiles(id),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Insert default approval threshold setting (e.g., 50000 Naira)
INSERT INTO settings (key, value, description) 
VALUES ('debit_approval_threshold', '50000', 'Amount threshold in Naira for requiring approval on debit transactions')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transaction_categories
CREATE POLICY "Admins can view all transaction categories"
    ON transaction_categories FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Chairman can manage transaction categories"
    ON transaction_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'chairman'
        )
    );

-- RLS Policies for transactions
CREATE POLICY "Admins can view all transactions"
    ON transactions FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert transactions"
    ON transactions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update pending transactions"
    ON transactions FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()) 
        AND status = 'pending'
    );

CREATE POLICY "Chairman and Treasurer can approve/reject transactions"
    ON transactions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('chairman', 'treasurer')
        )
    );

-- RLS Policies for account_balance
CREATE POLICY "Admins can view account balance"
    ON account_balance FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "System can update account balance"
    ON account_balance FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- RLS Policies for settings (if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'settings'
    ) THEN
        ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
        
        -- Drop policies if they exist
        DROP POLICY IF EXISTS "Admins can view settings" ON settings;
        DROP POLICY IF EXISTS "Chairman can manage settings" ON settings;
        
        -- Create policies
        CREATE POLICY "Admins can view settings"
            ON settings FOR SELECT
            USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
        
        CREATE POLICY "Chairman can manage settings"
            ON settings FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM admin_profiles 
                    WHERE id = auth.uid() AND role = 'chairman'
                )
            );
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE transactions IS 'General ledger for all credit and debit transactions';
COMMENT ON TABLE transaction_categories IS 'Configurable transaction categories managed by chairman';
COMMENT ON TABLE account_balance IS 'Account balance tracking, supports multiple accounts in future';
COMMENT ON COLUMN transactions.requires_approval IS 'True if transaction amount exceeds approval threshold';
COMMENT ON COLUMN transactions.account_id IS 'For future multi-account support, currently NULL for single account';
