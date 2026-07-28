-- Migration: Allow Multiple Partial Payments Per Obligation
-- Date: 2026-07-28
-- Purpose: Drop unique_payment_per_obligation constraint so multiple partial
--          payments can be recorded for the same landlord, type, month, and year.
--          The payments_reference_code_key unique constraint on reference_code
--          already prevents true accidental duplicates.

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS unique_payment_per_obligation;