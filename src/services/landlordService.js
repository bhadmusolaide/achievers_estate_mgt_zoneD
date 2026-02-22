import { supabase } from '../lib/supabase';
import { onboardingService } from './onboardingService';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';

export const landlordService = {
  /**
   * Get all landlords
   */
  async getAll(filters = {}, sortConfig = {}) {
    let query = supabase
      .from('landlords')
      .select('*');

    // Apply sorting if specified
    if (sortConfig.key) {
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
    } else {
      // Default sorting
      query = query.order('created_at', { ascending: false });
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.onboarding_status) {
      query = query.eq('onboarding_status', filters.onboarding_status);
    }
    if (filters.zone) {
      query = query.eq('zone', filters.zone);
    }
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,house_address.ilike.%${filters.search}%,road.ilike.%${filters.search}%`
      );
    }
    if (filters.road) {
      query = query.eq('road', filters.road);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Get landlord by ID with payment history
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('landlords')
      .select(`
        *,
        payments (
          *,
          payment_types (name),
          receipts (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new landlord with onboarding tasks
   */
  async create(landlord, skipOnboarding = false, adminId = null) {
    // Set onboarding defaults for new landlords
    const landlordData = {
      ...landlord,
      onboarding_status: skipOnboarding ? 'active' : 'pending',
      onboarding_started_at: skipOnboarding ? null : new Date().toISOString(),
      onboarding_completed_at: skipOnboarding ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('landlords')
      .insert([landlordData])
      .select()
      .single();

    if (error) throw error;

    // Create onboarding tasks if not skipping onboarding
    if (!skipOnboarding && data) {
      try {
        await onboardingService.createTasksForLandlord(data.id);
      } catch (taskError) {
        console.error('Failed to create onboarding tasks:', taskError);
        // Don't fail the landlord creation if tasks fail
      }
    }

    // Log the activity
    if (adminId) {
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.LANDLORD_CREATED,
        entityType: ENTITY_TYPES.LANDLORD,
        entityId: data.id,
        metadata: {
          full_name: data.full_name,
          house_address: data.house_address,
          zone: data.zone,
        },
      });
    }

    return data;
  },

  /**
   * Update a landlord
   */
  async update(id, updates, adminId = null) {
    const { data, error } = await supabase
      .from('landlords')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    if (adminId) {
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.LANDLORD_UPDATED,
        entityType: ENTITY_TYPES.LANDLORD,
        entityId: data.id,
        metadata: {
          updated_fields: Object.keys(updates).join(', '),
        },
      });
    }

    return data;
  },

  /**
   * Deactivate a landlord
   */
  async deactivate(id) {
    return this.update(id, { status: 'inactive' });
  },

  /**
   * Activate a landlord
   */
  async activate(id) {
    return this.update(id, { status: 'active' });
  },

  /**
   * Get landlord payment summary
   */
  async getPaymentSummary(id) {
    // Get confirmed payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('landlord_id', id)
      .eq('status', 'confirmed');

    if (paymentsError) throw paymentsError;

    // Get expected payments from assigned payment types
    const { data: assignedTypes, error: typesError } = await supabase
      .from('landlord_payment_types')
      .select('amount')
      .eq('landlord_id', id)
      .eq('active', true);

    if (typesError) throw typesError;

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalExpected = assignedTypes.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const totalDebt = Math.max(0, totalExpected - totalPaid);

    return {
      totalPaid,
      paymentCount: payments.length,
      totalExpected,
      totalDebt
    };
  },
};

export default landlordService;

