-- Migration: Update RLS policies on payments table for split permissions
-- Date: 2026-08-21
-- Purpose: INSERT uses has_feature('payments') so fin-sec can record payments,
--   while UPDATE/DELETE use has_feature('confirm_payments') so only the
--   treasurer (or whoever chairman designates) can confirm or remove payments.
--   Also re-applies policies for other tables with no semantic change.

DO $$
DECLARE
  rec record;
BEGIN
  -- ==================================================================
  -- Payments table: split INSERT vs UPDATE/DELETE permission checks
  -- ==================================================================

  DROP POLICY IF EXISTS feature_gate_insert ON payments;
  DROP POLICY IF EXISTS feature_gate_update ON payments;
  DROP POLICY IF EXISTS feature_gate_delete ON payments;

  CREATE POLICY feature_gate_insert ON payments AS RESTRICTIVE FOR INSERT
    TO authenticated WITH CHECK (has_feature('payments'));

  CREATE POLICY feature_gate_update ON payments AS RESTRICTIVE FOR UPDATE
    TO authenticated USING (has_feature('confirm_payments')) WITH CHECK (has_feature('confirm_payments'));

  CREATE POLICY feature_gate_delete ON payments AS RESTRICTIVE FOR DELETE
    TO authenticated USING (has_feature('confirm_payments'));

  -- ==================================================================
  -- Other tables: re-apply existing policies unchanged (for idempotency)
  -- ==================================================================
  FOR rec IN
    SELECT * FROM (VALUES
      ('landlords',          'landlords'),
      ('receipts',           'receipts'),
      ('celebrations_queue', 'celebrations'),
      ('onboarding_tasks',   'onboarding')
    ) AS t(tbl, feature)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS feature_gate_insert ON %I', rec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS feature_gate_update ON %I', rec.tbl);
    EXECUTE format('DROP POLICY IF EXISTS feature_gate_delete ON %I', rec.tbl);

    EXECUTE format(
      'CREATE POLICY feature_gate_insert ON %I AS RESTRICTIVE FOR INSERT '
      'TO authenticated WITH CHECK (has_feature(%L))', rec.tbl, rec.feature);

    EXECUTE format(
      'CREATE POLICY feature_gate_update ON %I AS RESTRICTIVE FOR UPDATE '
      'TO authenticated USING (has_feature(%L)) WITH CHECK (has_feature(%L))',
      rec.tbl, rec.feature, rec.feature);

    EXECUTE format(
      'CREATE POLICY feature_gate_delete ON %I AS RESTRICTIVE FOR DELETE '
      'TO authenticated USING (has_feature(%L))', rec.tbl, rec.feature);
  END LOOP;
END $$;