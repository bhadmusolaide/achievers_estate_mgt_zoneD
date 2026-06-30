-- Migration: Atomic transaction RPCs (create / approve / reject)
-- Date: 2026-06-30
-- Purpose: Make generic ledger operations atomic and server-verified. Each RPC
--   performs the status change, balance recompute, and activity log as a single
--   transaction, and derives the actor + enforces roles from auth.uid() so the
--   client cannot spoof identity or bypass approval rules.

-- ===========================================================================
-- create_transaction(): insert a transaction, auto-approving it unless it is a
-- debit at/above the configured approval threshold. Recomputes balance when
-- the transaction lands approved.
-- ===========================================================================
CREATE OR REPLACE FUNCTION create_transaction(
  p_transaction_type text,
  p_category_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_landlord_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_threshold numeric;
  v_needs_approval boolean := false;
  v_status text;
  v_tx transactions%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_profiles WHERE id = v_admin) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_transaction_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Invalid transaction_type';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_transaction_type = 'debit' THEN
    SELECT (value)::numeric INTO v_threshold FROM settings WHERE key = 'debit_approval_threshold';
    IF v_threshold IS NULL THEN v_threshold := 50000; END IF;
    v_needs_approval := p_amount >= v_threshold;
  END IF;

  v_status := CASE WHEN v_needs_approval THEN 'pending' ELSE 'approved' END;

  INSERT INTO transactions (
    transaction_type, category_id, amount, description, reference,
    landlord_id, payment_id, status, requires_approval,
    created_by, approved_by, approved_at
  ) VALUES (
    p_transaction_type, p_category_id, p_amount, p_description, p_reference,
    p_landlord_id, p_payment_id, v_status, v_needs_approval,
    v_admin,
    CASE WHEN v_needs_approval THEN NULL ELSE v_admin END,
    CASE WHEN v_needs_approval THEN NULL ELSE NOW() END
  ) RETURNING * INTO v_tx;

  IF NOT v_needs_approval THEN
    PERFORM recompute_account_balance();
    UPDATE account_balance SET last_transaction_id = v_tx.id
     WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;

  INSERT INTO activity_logs (actor_admin_id, action_type, entity_type, entity_id, metadata)
  VALUES (v_admin, 'transaction_created', 'transaction', v_tx.id,
          jsonb_build_object('transaction_type', p_transaction_type, 'amount', p_amount,
                             'category_id', p_category_id, 'requires_approval', v_needs_approval));

  RETURN to_jsonb(v_tx);
END;
$$;

-- ===========================================================================
-- approve_transaction(): approve a pending transaction (role-gated) and
-- recompute the balance.
-- ===========================================================================
CREATE OR REPLACE FUNCTION approve_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_role text;
  v_roles jsonb;
  v_tx transactions%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM admin_profiles WHERE id = v_admin;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT (value)::jsonb INTO v_roles FROM settings WHERE key = 'approval_roles';
  IF v_roles IS NULL THEN v_roles := '["chairman","treasurer"]'::jsonb; END IF;
  IF NOT (v_roles ? v_role) THEN
    RAISE EXCEPTION 'Your role is not permitted to approve transactions';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx.status <> 'pending' THEN RAISE EXCEPTION 'Transaction is not pending approval'; END IF;

  UPDATE transactions SET status = 'approved', approved_by = v_admin, approved_at = NOW()
   WHERE id = p_transaction_id RETURNING * INTO v_tx;

  PERFORM recompute_account_balance();
  UPDATE account_balance SET last_transaction_id = v_tx.id
   WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO activity_logs (actor_admin_id, action_type, entity_type, entity_id, metadata)
  VALUES (v_admin, 'transaction_approved', 'transaction', v_tx.id,
          jsonb_build_object('transaction_type', v_tx.transaction_type, 'amount', v_tx.amount));

  RETURN to_jsonb(v_tx);
END;
$$;

-- ===========================================================================
-- reject_transaction(): reject a pending transaction (role-gated). No balance
-- change since rejected transactions are excluded from the balance.
-- ===========================================================================
CREATE OR REPLACE FUNCTION reject_transaction(p_transaction_id uuid, p_reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_role text;
  v_roles jsonb;
  v_tx transactions%ROWTYPE;
BEGIN
  SELECT role INTO v_role FROM admin_profiles WHERE id = v_admin;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT (value)::jsonb INTO v_roles FROM settings WHERE key = 'approval_roles';
  IF v_roles IS NULL THEN v_roles := '["chairman","treasurer"]'::jsonb; END IF;
  IF NOT (v_roles ? v_role) THEN
    RAISE EXCEPTION 'Your role is not permitted to reject transactions';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx.status <> 'pending' THEN RAISE EXCEPTION 'Transaction is not pending approval'; END IF;

  UPDATE transactions SET status = 'rejected', rejected_by = v_admin,
         rejected_at = NOW(), rejection_reason = p_reason
   WHERE id = p_transaction_id RETURNING * INTO v_tx;

  INSERT INTO activity_logs (actor_admin_id, action_type, entity_type, entity_id, metadata)
  VALUES (v_admin, 'transaction_rejected', 'transaction', v_tx.id,
          jsonb_build_object('transaction_type', v_tx.transaction_type, 'amount', v_tx.amount,
                             'rejection_reason', LEFT(COALESCE(p_reason, ''), 200)));

  RETURN to_jsonb(v_tx);
END;
$$;

GRANT EXECUTE ON FUNCTION create_transaction(text, uuid, numeric, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_transaction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_transaction(uuid, text) TO authenticated;
