import { supabase } from '../lib/supabase';
import { generateReferenceCode } from '../utils/helpers';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';
import toastService from './toastService';

// Minimum number of completed onboarding tasks required before a landlord
// becomes eligible for payments (even if onboarding is not fully complete).
export const MIN_ONBOARDING_TASKS_FOR_PAYMENT = 4;

export const paymentService = {
  /**
   * Get all payments with filters
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('payments')
      .select(`
        *,
        landlords (id, title, full_name, phone, house_address),
        payment_types (id, name),
        admin_profiles:logged_by (full_name),
        receipts (*)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.payment_type_id) {
      query = query.eq('payment_type_id', filters.payment_type_id);
    }
    if (filters.payment_month) {
      query = query.eq('payment_month', filters.payment_month);
    }
    if (filters.payment_year) {
      query = query.eq('payment_year', filters.payment_year);
    }
    if (filters.landlord_id) {
      query = query.eq('landlord_id', filters.landlord_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Get payment by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        landlords (*),
        payment_types (*),
        admin_profiles:logged_by (full_name, role),
        receipts (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Check if landlord is eligible for payments.
   * A landlord is eligible if onboarding is already complete (active), or if at
   * least MIN_ONBOARDING_TASKS_FOR_PAYMENT onboarding tasks have been completed.
   */
  async checkLandlordEligibility(landlordId) {
    const { data, error } = await supabase
      .from('landlords')
      .select('id, full_name, onboarding_status, onboarding_tasks (completed)')
      .eq('id', landlordId)
      .single();

    if (error) throw error;

    if (data.onboarding_status !== 'pending') {
      return true;
    }

    const completedCount = (data.onboarding_tasks || []).filter(
      (task) => task.completed
    ).length;

    if (completedCount < MIN_ONBOARDING_TASKS_FOR_PAYMENT) {
      throw new Error(
        `Cannot record payment for ${data.full_name}. At least ${MIN_ONBOARDING_TASKS_FOR_PAYMENT} onboarding tasks must be completed (${completedCount} completed so far).`
      );
    }

    return true;
  },

  /**
   * Create a new payment
   */
  async create(payment, adminId) {
    try {
      // Check landlord eligibility first
      await this.checkLandlordEligibility(payment.landlord_id);

      // Get payment type name for reference code
      const { data: paymentType } = await supabase
        .from('payment_types')
        .select('name')
        .eq('id', payment.payment_type_id)
        .single();

      // Set default values for new fields if not provided
      const paymentWithDefaults = {
        ...payment,
        obligation_description: payment.obligation_description || '',
        installment_number: payment.installment_number || 1,
        total_installments: payment.total_installments || 1
      };

      const referenceCode = generateReferenceCode(
        payment.landlord_id,
        payment.payment_year,
        payment.payment_month,
        paymentType?.name || 'PAY'
      );

      const { data, error } = await supabase
        .from('payments')
        .insert([{
          ...paymentWithDefaults,
          reference_code: referenceCode,
          logged_by: adminId,
          status: 'pending',
        }])
        .select()
        .single();

      if (error) throw error;

      // Log the activity
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.PAYMENT_LOGGED,
        entityType: ENTITY_TYPES.PAYMENT,
        entityId: data.id,
        metadata: {
          amount: payment.amount,
          payment_type: paymentType?.name || 'unknown',
          year: payment.payment_year,
          month: payment.payment_month,
          landlord_id: payment.landlord_id,
        },
      });

      // Show success toast
      toastService.success(`Payment logged successfully (Ref: ${referenceCode})`);

      return data;
    } catch (error) {
      // Show error toast
      toastService.error(`Failed to log payment: ${error.message}`);
      throw error;
    }
  },

  /**
   * Confirm a payment.
   * Delegates to the `confirm_payment` Postgres RPC so the payment update,
   * matching credit transaction, account-balance recompute, and activity-log
   * trail all commit (or roll back) as a single database transaction.
   */
  async confirm(id) {
    try {
      const { data, error } = await supabase.rpc('confirm_payment', {
        p_payment_id: id,
      });

      if (error) throw error;

      toastService.success(`Payment confirmed successfully (Ref: ${data.reference_code})`);

      return data;
    } catch (error) {
      toastService.error(`Failed to confirm payment: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get payment types
   */
  async getPaymentTypes() {
    const { data, error } = await supabase
      .from('payment_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Check for duplicate payment
   */
  async checkDuplicate(landlordId, paymentTypeId, month, year) {
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .eq('landlord_id', landlordId)
      .eq('payment_type_id', paymentTypeId)
      .eq('payment_month', month)
      .eq('payment_year', year)
      .eq('obligation_description', ''); // Only check for duplicates without specific obligations

    if (error) throw error;
    return data.length > 0;
  },
};

export default paymentService;

