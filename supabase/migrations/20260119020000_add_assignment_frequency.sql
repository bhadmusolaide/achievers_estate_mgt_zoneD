-- Migration: Add Frequency Column to Landlord Payment Types
-- Date: 2026-01-21
-- Purpose: Allow per-assignment frequency override for payment types

-- Add frequency and period columns to landlord_payment_types table
ALTER TABLE landlord_payment_types
ADD COLUMN frequency VARCHAR(20) DEFAULT 'monthly'
CHECK (frequency IN ('monthly', 'yearly', 'one-time'));

ALTER TABLE landlord_payment_types
ADD COLUMN start_month INTEGER CHECK (start_month BETWEEN 1 AND 12);

ALTER TABLE landlord_payment_types
ADD COLUMN start_year INTEGER CHECK (start_year >= 2020);

-- Update comments
COMMENT ON COLUMN landlord_payment_types.frequency IS 'Payment frequency for this specific assignment. Overrides payment_types.frequency if set.';
COMMENT ON COLUMN landlord_payment_types.start_month IS 'Starting month for this assignment (1-12). For yearly assignments, this is ignored.';
COMMENT ON COLUMN landlord_payment_types.start_year IS 'Starting year for this assignment. For monthly assignments, this specifies the year.';