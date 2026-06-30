-- Migration: Atomic account balance + atomic payment confirmation
-- Date: 2026-06-30
-- Purpose:
--   1. Make the account balance a single source of truth derived from approved
--      transactions, eliminating client-side read-then-write races.
--   2. Make payment confirmation (payment update + ledger credit + balance +
--      activity logs) commit or roll back as one database transaction.

-- Constant id of the single main account (matches existing app code)
-- '00000000-0000-0000-0000-000000000001'

-- ===========================================================================
-- recompute_account_balance(): set the main account balance to the net sum of
-- all approved transactions. Safe to call repeatedly; self-heals any drift.
-- ===========================================================================
CREATE OR REPLACE FUNCTION recompute_account_balance()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(
           SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END),
           0)
    INTO v_balance
  FROM transactions
  WHERE status = 'approved';

  INSERT INTO account_balance (id, account_name, balance, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Main Account', v_balance, NOW())
  ON CONFLICT (id) DO UPDATE
    SET balance = EXCLUDED.balance, updated_at = NOW();

  RETURN v_balance;
END;
$$;

-- ===========================================================================
-- confirm_payment(p_payment_id): atomically confirm a pending payment, create
-- and approve the matching credit transaction, recompute the balance, and
-- write the activity-log trail. Uses row locking to block double confirmation.
-- ===========================================================================
CREATE OR REPLACE FUNCTION confirm_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_payment payments%ROWTYPE;
  v_landlord_name text;
  v_payment_type_name text;
  v_category_id uuid;
  v_tx_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_profiles WHERE id = v_admin) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Lock the payment row to prevent concurrent confirmation
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending (current status: %)', v_payment.status;
  END IF;

  UPDATE payments
     SET status = 'confirmed', confirmed_at = NOW()
   WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  SELECT full_name INTO v_landlord_name FROM landlords WHERE id = v_payment.landlord_id;
  SELECT name INTO v_payment_type_name FROM payment_types WHERE id = v_payment.payment_type_id;

  SELECT id INTO v_category_id
    FROM transaction_categories
   WHERE name = 'rent_income' AND type = 'credit'
   LIMIT 1;

  -- Create + approve the credit transaction (idempotent per payment)
  IF v_category_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM transactions WHERE payment_id = p_payment_id) THEN
    INSERT INTO transactions (
      transaction_type, category_id, amount, description, reference,
      landlord_id, payment_id, status, requires_approval,
      created_by, approved_by, approved_at
    ) VALUES (
      'credit', v_category_id, v_payment.amount,
      'Payment from ' || COALESCE(v_landlord_name, 'Landlord')
        || ' - ' || COALESCE(v_payment_type_name, 'Payment'),
      v_payment.reference_code, v_payment.landlord_id, v_payment.id,
      'approved', false, v_admin, v_admin, NOW()
    ) RETURNING id INTO v_tx_id;

    INSERT INTO activity_logs (actor_admin_id, action_type, entity_type, entity_id, metadata)
    VALUES
      (v_admin, 'transaction_created', 'transaction', v_tx_id,
        jsonb_build_object('transaction_type', 'credit', 'amount', v_payment.amount,
                           'category_id', v_category_id, 'requires_approval', false)),
      (v_admin, 'transaction_approved', 'transaction', v_tx_id,
        jsonb_build_object('transaction_type', 'credit', 'amount', v_payment.amount));
  END IF;

  -- Recompute balance from the approved set (single source of truth)
  PERFORM recompute_account_balance();

  IF v_tx_id IS NOT NULL THEN
    UPDATE account_balance
       SET last_transaction_id = v_tx_id
     WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;

  INSERT INTO activity_logs (actor_admin_id, action_type, entity_type, entity_id, metadata)
  VALUES (v_admin, 'payment_confirmed', 'payment', v_payment.id,
          jsonb_build_object('amount', v_payment.amount,
                             'reference_code', v_payment.reference_code));

  RETURN to_jsonb(v_payment);
END;
$$;

-- Allow authenticated clients to call these RPCs (each verifies admin internally)
GRANT EXECUTE ON FUNCTION recompute_account_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_payment(uuid) TO authenticated;

-- One-time reconcile of the existing stored balance with the approved set
INSERT INTO account_balance (id, account_name, balance, updated_at)
SELECT '00000000-0000-0000-0000-000000000001', 'Main Account',
       COALESCE((SELECT SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE -amount END)
                   FROM transactions WHERE status = 'approved'), 0),
       NOW()
ON CONFLICT (id) DO UPDATE
  SET balance = EXCLUDED.balance, updated_at = NOW();

COMMENT ON FUNCTION recompute_account_balance() IS 'Sets main account balance to net sum of approved transactions. Single source of truth.';
COMMENT ON FUNCTION confirm_payment(uuid) IS 'Atomically confirms a payment, creates/approves its credit transaction, recomputes balance, and logs the trail.';
