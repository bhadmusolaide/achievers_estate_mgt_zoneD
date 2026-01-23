-- Migration: Add Payment Frequency Support
-- Date: 2026-01-19
-- Purpose: Add frequency field to payment_types to support monthly, yearly, and one-time payments

-- Add frequency column to payment_types table
ALTER TABLE payment_types
ADD COLUMN frequency VARCHAR(20) DEFAULT 'monthly'
CHECK (frequency IN ('monthly', 'yearly', 'one-time'));

-- Update existing payment types with appropriate frequencies
UPDATE payment_types SET frequency = 'monthly' WHERE name = 'dues';
UPDATE payment_types SET frequency = 'one-time' WHERE name = 'levy';
UPDATE payment_types SET frequency = 'yearly' WHERE name = 'security';
UPDATE payment_types SET frequency = 'one-time' WHERE name = 'project';

-- Add comment for documentation
COMMENT ON COLUMN payment_types.frequency IS 'Payment frequency: monthly (recurring every month), yearly (annual), one-time (special payments)';