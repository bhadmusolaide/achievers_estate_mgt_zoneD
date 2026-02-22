-- Migration: Enhance Payment Tracking for Individual Obligations
-- Date: 2026-01-23
-- Purpose: Add support for tracking individual payment obligations and installments

-- Add columns for better payment tracking
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS obligation_description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_installments INTEGER DEFAULT 1;

-- Drop the old unique constraint that prevents multiple payments of same type per period
ALTER TABLE payments DROP CONSTRAINT IF EXISTS unique_payment_per_period;

-- Create new constraint that allows multiple payments when they have different descriptions
ALTER TABLE payments 
ADD CONSTRAINT unique_payment_per_obligation 
UNIQUE (landlord_id, payment_type_id, payment_month, payment_year, obligation_description);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_obligation_desc ON payments(obligation_description);
CREATE INDEX IF NOT EXISTS idx_payments_installment ON payments(installment_number, total_installments);

-- Comments for documentation
COMMENT ON COLUMN payments.obligation_description IS 'Description to distinguish between different obligations of the same payment type';
COMMENT ON COLUMN payments.installment_number IS 'Current installment number for installment payments (1-based)';
COMMENT ON COLUMN payments.total_installments IS 'Total number of installments for this obligation';
