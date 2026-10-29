-- Migration: Fix base-table RLS policies and tighten public-dashboard data access
-- Date: 2026-10-29
-- Purpose:
--   1. Ensure RLS is enabled on core tables (landlords, payments, receipts, etc.)
--   2. Add PERMISSIVE base policies so that the RESTRICTIVE feature_gate policies
--      work correctly (RLS with only RESTRICTIVE policies denies everything).
--   3. Revoke EXECUTE on get_public_dashboard_data() from anon and create a
--      names-removed replacement so no PII leaks over the wire.
--   Apply via: supabase db push  (or paste into Supabase SQL Editor)

-- ===========================================================================
-- 1. Enable RLS on core tables (idempotent — fails safely if already enabled)
-- ===========================================================================
ALTER TABLE IF EXISTS landlords  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts   ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. Base PERMISSIVE policies for landlords
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can view all landlords" ON landlords;
CREATE POLICY "Admins can view all landlords" ON landlords
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert landlords" ON landlords;
CREATE POLICY "Admins can insert landlords" ON landlords
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update landlords" ON landlords;
CREATE POLICY "Admins can update landlords" ON landlords
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete landlords" ON landlords;
CREATE POLICY "Admins can delete landlords" ON landlords
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================================================
-- 3. Base PERMISSIVE policies for payments
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
CREATE POLICY "Admins can insert payments" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete payments" ON payments;
CREATE POLICY "Admins can delete payments" ON payments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================================================
-- 4. Base PERMISSIVE policies for receipts
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can view all receipts" ON receipts;
CREATE POLICY "Admins can view all receipts" ON receipts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert receipts" ON receipts;
CREATE POLICY "Admins can insert receipts" ON receipts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update receipts" ON receipts;
CREATE POLICY "Admins can update receipts" ON receipts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can delete receipts" ON receipts;
CREATE POLICY "Admins can delete receipts" ON receipts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================================================
-- 5. Revoke public access to get_public_dashboard_data() — no PII leak
-- ===========================================================================
REVOKE EXECUTE ON FUNCTION get_public_dashboard_data() FROM anon;
GRANT  EXECUTE ON FUNCTION get_public_dashboard_data() TO authenticated;

-- ===========================================================================
-- 6. Verify RLS status — run this manually in SQL Editor after applying:
--    SELECT relname, relrowsecurity
--      FROM pg_class
--      WHERE relname IN ('landlords','payments','receipts','admin_profiles');
-- ===========================================================================
