-- Migration: Enforce feature_permissions at the database level (RLS)
-- Date: 2026-06-30
-- Purpose: feature_permissions was previously only honored in the UI, so a
--   disabled feature could still be mutated via the API. This adds a has_feature()
--   helper and layers AS RESTRICTIVE write policies on the feature-scoped tables.
--
-- Design notes:
--   * RESTRICTIVE policies are AND-ed with the existing PERMISSIVE (role) policies,
--     so we gate writes WITHOUT dropping/recreating any existing policy.
--   * Only INSERT/UPDATE/DELETE are gated. SELECT is intentionally left open so
--     cross-feature dashboards/reports keep working (matches UI semantics).
--   * SECURITY DEFINER RPCs (e.g. confirm_payment) run as owner and bypass RLS,
--     so atomic financial flows are unaffected.

-- ===========================================================================
-- has_feature(p_feature): true when the current user may use a feature.
--   - chairman always has full access
--   - a feature is enabled unless explicitly set to false (missing key => enabled)
--   - non-admins are denied
-- ===========================================================================
CREATE OR REPLACE FUNCTION has_feature(p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'chairman'
         OR COALESCE((feature_permissions ->> p_feature)::boolean, true)
       FROM admin_profiles
      WHERE id = auth.uid()),
    false);
$$;

GRANT EXECUTE ON FUNCTION has_feature(text) TO authenticated;

COMMENT ON FUNCTION has_feature(text) IS
  'Returns true if the current auth.uid() admin may use the given feature key (chairman always true; missing key defaults to enabled).';

-- ===========================================================================
-- Apply RESTRICTIVE write gates to each feature-scoped table.
-- ===========================================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('landlords',          'landlords'),
      ('payments',           'payments'),
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
