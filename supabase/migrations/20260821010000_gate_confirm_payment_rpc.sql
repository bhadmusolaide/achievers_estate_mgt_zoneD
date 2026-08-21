-- Migration: Introduce confirm_payments permission & gate confirm_payment RPC
-- Date: 2026-08-21
-- Purpose:
--   Split the single "payments" feature into two permissions:
--     - payments:         allows creating/recording payments (fin-sec)
--     - confirm_payments: allows confirming/approving recorded payments (treasurer)
--   The confirm_payment RPC is SECURITY DEFINER and bypasses row-level security,
--   so it must independently check has_feature('confirm_payments').

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

  -- Must have confirm_payments feature to confirm a payment
  IF NOT has_feature('confirm_payments') THEN
    RAISE EXCEPTION 'Permission denied: confirm_payments feature is disabled for your account';
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