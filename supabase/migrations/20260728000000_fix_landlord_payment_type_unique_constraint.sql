-- Migration: Fix Landlord Payment Types Unique Constraint
-- Date: 2026-07-28
-- Purpose: Change unique constraint to include start_year so the same payment type
--          can be assigned for different years without overwriting

-- First, backfill any NULL start_year values (should not exist, but be safe)
UPDATE landlord_payment_types
SET start_year = EXTRACT(YEAR FROM assigned_at)
WHERE start_year IS NULL;

-- Make start_year NOT NULL going forward
ALTER TABLE landlord_payment_types
  ALTER COLUMN start_year SET NOT NULL,
  ALTER COLUMN start_year SET DEFAULT EXTRACT(YEAR FROM NOW());

-- Drop the old unique constraint that only covered landlord_id + payment_type_id
ALTER TABLE landlord_payment_types
  DROP CONSTRAINT IF EXISTS unique_landlord_payment_type;

-- Add new unique constraint that includes start_year
-- This allows the same payment type to be assigned to the same landlord
-- for different years (e.g., Yearly Ground Rent 2025, Yearly Ground Rent 2026)
ALTER TABLE landlord_payment_types
  ADD CONSTRAINT unique_landlord_payment_type_year
  UNIQUE (landlord_id, payment_type_id, start_year);