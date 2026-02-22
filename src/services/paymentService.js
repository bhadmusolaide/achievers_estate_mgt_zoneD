import { supabase } from '../lib/supabase';
import { generateReferenceCode } from '../utils/helpers';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';
import { transactionService } from './transactionService';
import toastService from './toastService';

export const paymentService = {
  /**
   * Get all payments with filters
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('payments')
      .select(`
        *,
        landlords (id, full_name, phone, house_address),
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
   * Check if landlord is eligible for payments (onboarding complete)
   */
  async checkLandlordEligibility(landlordId) {
    const { data, error } = await supabase
      .from('landlords')
      .select('id, full_name, onboarding_status')
      .eq('id', landlordId)
      .single();

    if (error) throw error;

    if (data.onboarding_status === 'pending') {
      throw new Error(
        `Cannot record payment for ${data.full_name}. Landlord onboarding is not complete.`
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
   * Confirm a payment
   */
  async confirm(id, adminId) {
    try {
      // Get payment details first
      const { data: paymentData, error: fetchError } = await supabase
        .from('payments')
        .select(`
          *,
          landlords (id, full_name),
          payment_types (name)
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update payment status
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;

      // Auto-create credit transaction for confirmed payment
      try {
        // Get rent_income category
        const categories = await transactionService.getCategories('credit');
        const rentIncomeCategory = categories.find(c => c.name === 'rent_income');
        
        if (!rentIncomeCategory) {
          console.warn('rent_income category not found. Transaction not created for payment:', data.id);
        } else if (!adminId) {
          console.warn('adminId is required to create transaction. Transaction not created for payment:', data.id);
        } else {
          const transaction = await transactionService.create({
            transaction_type: 'credit',
            category_id: rentIncomeCategory.id,
            amount: parseFloat(data.amount),
            description: `Payment from ${paymentData.landlords?.full_name || 'Landlord'} - ${paymentData.payment_types?.name || 'Payment'}`,
            reference: data.reference_code,
            landlord_id: data.landlord_id,
            payment_id: data.id,
          }, adminId);

          // Auto-approve the transaction if it's pending (payment-based transactions should always be approved)
          if (transaction.status === 'pending') {
            await transactionService.approve(transaction.id, adminId);
          }
        }
      } catch (transactionError) {
        // Log error but don't fail payment confirmation
        console.error('Error creating transaction for payment:', transactionError);
        console.error('Payment ID:', data.id, 'Admin ID:', adminId);
      }

      // Log the activity
      if (adminId) {
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.PAYMENT_CONFIRMED,
          entityType: ENTITY_TYPES.PAYMENT,
          entityId: data.id,
          metadata: {
            amount: data.amount,
            reference_code: data.reference_code,
          },
        });
      }

      // Show success toast
      toastService.success(`Payment confirmed successfully (Ref: ${data.reference_code})`);

      return data;
    } catch (error) {
      // Show error toast
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

