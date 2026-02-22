-- Migration: Add Landlord Payment Types Assignment Table
-- Date: 2026-01-19
-- Purpose: Track which payment types each landlord is expected to pay for Financial Overview

-- Create landlord_payment_types table
CREATE TABLE IF NOT EXISTS landlord_payment_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    payment_type_id UUID NOT NULL REFERENCES payment_types(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    active BOOLEAN DEFAULT TRUE,
    assigned_by UUID REFERENCES admin_profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique assignment per landlord and payment type
    CONSTRAINT unique_landlord_payment_type UNIQUE (landlord_id, payment_type_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_landlord_payment_types_landlord ON landlord_payment_types(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_payment_types_payment_type ON landlord_payment_types(payment_type_id);
CREATE INDEX IF NOT EXISTS idx_landlord_payment_types_active ON landlord_payment_types(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_landlord_payment_types_assigned_by ON landlord_payment_types(assigned_by);

-- Enable RLS
ALTER TABLE landlord_payment_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access
CREATE POLICY "Admins can view all landlord payment types"
    ON landlord_payment_types FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Treasurers and Financial Secretaries can insert landlord payment types"
    ON landlord_payment_types FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('treasurer', 'chairman', 'secretary')
        )
    );

CREATE POLICY "Treasurers and Financial Secretaries can update landlord payment types"
    ON landlord_payment_types FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('treasurer', 'chairman', 'secretary')
        )
    );

CREATE POLICY "Treasurers and Financial Secretaries can delete landlord payment types"
    ON landlord_payment_types FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('treasurer', 'chairman', 'secretary')
        )
    );

-- Add amount column to payment_types table if it doesn't exist
-- This stores the default/standard amount for each payment type
ALTER TABLE payment_types ADD COLUMN IF NOT EXISTS default_amount DECIMAL(12, 2) DEFAULT 0;

-- Comments for documentation
COMMENT ON TABLE landlord_payment_types IS 'Tracks payment type assignments for landlords. Used in Financial Overview to calculate expected payments.';
COMMENT ON COLUMN landlord_payment_types.amount IS 'Expected amount for this payment type for this landlord. Can differ from payment_types.default_amount.';
COMMENT ON COLUMN landlord_payment_types.active IS 'Whether this payment type is currently assigned. Soft delete pattern.';

