-- Centralized data wipe RPC for the Danger Zone feature.
-- Runs as SECURITY DEFINER so all tables are cleared regardless of RLS policies.

-- Missing DELETE policies that could block non-service-role callers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Admins can delete feedback'
  ) THEN
    CREATE POLICY "Admins can delete feedback"
      ON feedback FOR DELETE
      USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debt_payments'
      AND policyname = 'Admins can delete debt payments'
  ) THEN
    CREATE POLICY "Admins can delete debt payments"
      ON debt_payments FOR DELETE
      USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION wipe_all_application_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB := '[]'::JSONB;
  v_count INTEGER;
BEGIN
  DELETE FROM activity_log_details WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'activity_log_details', 'count', v_count));

  DELETE FROM activity_logs WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'activity_logs', 'count', v_count));

  DELETE FROM receipts WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'receipts', 'count', v_count));

  UPDATE account_balance
  SET last_transaction_id = NULL
  WHERE id = '00000000-0000-0000-0000-000000000001';

  DELETE FROM transactions WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'transactions', 'count', v_count));

  DELETE FROM payments WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'payments', 'count', v_count));

  DELETE FROM onboarding_tasks WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'onboarding_tasks', 'count', v_count));

  DELETE FROM onboarding_activity_log WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'onboarding_activity_log', 'count', v_count));

  DELETE FROM debt_payments WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'debt_payments', 'count', v_count));

  DELETE FROM project_debts WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'project_debts', 'count', v_count));

  DELETE FROM projects WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'projects', 'count', v_count));

  DELETE FROM pledges WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'pledges', 'count', v_count));

  DELETE FROM celebrations_queue WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'celebrations_queue', 'count', v_count));

  DELETE FROM landlord_payment_types WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'landlord_payment_types', 'count', v_count));

  DELETE FROM landlords WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'landlords', 'count', v_count));

  DELETE FROM feedback WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'feedback', 'count', v_count));

  UPDATE account_balance
  SET balance = 0
  WHERE id = '00000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_results := v_results || jsonb_build_array(jsonb_build_object('table', 'account_balance (reset)', 'count', v_count));

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION wipe_all_application_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wipe_all_application_data() TO service_role;

COMMENT ON FUNCTION wipe_all_application_data IS
  'Deletes all operational data (landlords, payments, zone projects, feedback, etc.) while preserving admin accounts, payment types, transaction categories, celebration templates, and settings.';
