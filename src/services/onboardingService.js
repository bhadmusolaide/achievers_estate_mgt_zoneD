import { supabase } from '../lib/supabase';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';

// Standard onboarding tasks that are seeded for each new landlord
export const STANDARD_ONBOARDING_TASKS = [
  { task_key: 'confirm_contact_details', task_label: 'Confirm Contact Details', required: true },
  { task_key: 'verify_house_details', task_label: 'Verify House Details', required: true },
  { task_key: 'confirm_occupancy_type', task_label: 'Confirm Occupancy Type', required: true },
  { task_key: 'add_annual_charge', task_label: 'Add Annual Charge', required: true },
  { task_key: 'join_whatsapp_group', task_label: 'Join WhatsApp Group', required: true },
];

export const onboardingService = {
  /**
   * Get all landlords with pending onboarding
   */
  async getPendingLandlords() {
    const { data, error } = await supabase
      .from('landlords')
      .select(`
        *,
        onboarding_tasks (*)
      `)
      .eq('onboarding_status', 'pending')
      .order('onboarding_started_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all landlords with completed onboarding
   */
  async getCompletedLandlords(limit = 50) {
    const { data, error } = await supabase
      .from('landlords')
      .select(`
        *,
        onboarding_tasks (*)
      `)
      .eq('onboarding_status', 'active')
      .not('onboarding_completed_at', 'is', null)
      .order('onboarding_completed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get onboarding tasks for a specific landlord
   */
  async getLandlordTasks(landlordId) {
    const { data, error } = await supabase
      .from('onboarding_tasks')
      .select(`
        *,
        completed_by_admin:admin_profiles!completed_by(full_name)
      `)
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get landlord with onboarding details
   */
  async getLandlordWithOnboarding(landlordId) {
    const { data, error } = await supabase
      .from('landlords')
      .select(`
        *,
        onboarding_tasks (
          *,
          completed_by_admin:admin_profiles!completed_by(full_name)
        )
      `)
      .eq('id', landlordId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create onboarding tasks for a new landlord
   */
  async createTasksForLandlord(landlordId) {
    const tasks = STANDARD_ONBOARDING_TASKS.map(task => ({
      landlord_id: landlordId,
      ...task,
    }));

    const { data, error } = await supabase
      .from('onboarding_tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return data;
  },

  /**
   * Complete an onboarding task
   */
  async completeTask(taskId, adminId, notes = null) {
    // Update the task
    const { data: task, error: taskError } = await supabase
      .from('onboarding_tasks')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: adminId,
        notes,
      })
      .eq('id', taskId)
      .select('*, landlord_id, task_key')
      .single();

    if (taskError) throw taskError;

    // Log to legacy onboarding_activity_log
    await this.logActivity(adminId, task.landlord_id, 'onboarding_task_completed', task.task_key);

    // Log to global activity_logs
    await activityLogService.log({
      adminId,
      actionType: ACTION_TYPES.ONBOARDING_TASK_COMPLETED,
      entityType: ENTITY_TYPES.ONBOARDING_TASK,
      entityId: taskId,
      metadata: {
        task_key: task.task_key,
        landlord_id: task.landlord_id,
      },
    });

    // Check if all required tasks are complete
    await this.checkAndUpdateOnboardingStatus(task.landlord_id, adminId);

    return task;
  },

  /**
   * Uncomplete an onboarding task (if needed for correction)
   */
  async uncompleteTask(taskId, adminId) {
    const { data: task, error: taskError } = await supabase
      .from('onboarding_tasks')
      .update({
        completed: false,
        completed_at: null,
        completed_by: null,
      })
      .eq('id', taskId)
      .select('*, landlord_id, task_key')
      .single();

    if (taskError) throw taskError;

    // Log the activity
    await this.logActivity(adminId, task.landlord_id, 'onboarding_task_uncompleted', task.task_key);

    // Revert landlord to pending if they were active
    await this.revertToPending(task.landlord_id, adminId);

    return task;
  },

  /**
   * Update task notes
   */
  async updateTaskNotes(taskId, notes) {
    const { data, error } = await supabase
      .from('onboarding_tasks')
      .update({ notes })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Check if all required tasks are complete and update landlord status
   */
  async checkAndUpdateOnboardingStatus(landlordId, adminId) {
    // Get all required tasks for this landlord
    const { data: tasks, error } = await supabase
      .from('onboarding_tasks')
      .select('*')
      .eq('landlord_id', landlordId)
      .eq('required', true);

    if (error) throw error;

    // Check if all required tasks are complete
    const allComplete = tasks.every(task => task.completed);

    if (allComplete) {
      // Update landlord to active
      const { error: updateError } = await supabase
        .from('landlords')
        .update({
          onboarding_status: 'active',
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', landlordId);

      if (updateError) throw updateError;

      // Log the completion
      await this.logActivity(adminId, landlordId, 'onboarding_completed', null);

      return true;
    }

    return false;
  },

  /**
   * Revert landlord to pending status
   */
  async revertToPending(landlordId, adminId) {
    const { error } = await supabase
      .from('landlords')
      .update({
        onboarding_status: 'pending',
        onboarding_completed_at: null,
      })
      .eq('id', landlordId);

    if (error) throw error;

    await this.logActivity(adminId, landlordId, 'onboarding_reverted', null);
  },

  /**
   * Log onboarding activity
   */
  async logActivity(adminId, landlordId, actionType, taskKey, details = null) {
    const { error } = await supabase
      .from('onboarding_activity_log')
      .insert({
        admin_id: adminId,
        landlord_id: landlordId,
        action_type: actionType,
        task_key: taskKey,
        details,
      });

    if (error) console.error('Failed to log onboarding activity:', error);
  },

  /**
   * Get onboarding activity log for a landlord
   */
  async getActivityLog(landlordId) {
    const { data, error } = await supabase
      .from('onboarding_activity_log')
      .select(`
        *,
        admin:admin_profiles(full_name)
      `)
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Bulk mark multiple landlords as completed
   */
  async bulkMarkCompleted(landlordIds, adminId) {
    if (!landlordIds || landlordIds.length === 0) {
      throw new Error('No landlords selected');
    }

    const completedAt = new Date().toISOString();

    // Update all landlords to active status
    const { error: updateError } = await supabase
      .from('landlords')
      .update({
        onboarding_status: 'active',
        onboarding_completed_at: completedAt,
      })
      .in('id', landlordIds)
      .eq('onboarding_status', 'pending');

    if (updateError) throw updateError;

    // Mark all required tasks as completed for each landlord
    for (const landlordId of landlordIds) {
      // Get all required tasks for this landlord
      const { data: tasks, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('id')
        .eq('landlord_id', landlordId)
        .eq('required', true)
        .eq('completed', false);

      if (tasksError) {
        console.error(`Error fetching tasks for landlord ${landlordId}:`, tasksError);
        continue;
      }

      if (tasks && tasks.length > 0) {
        // Mark all required tasks as completed
        const { error: completeError } = await supabase
          .from('onboarding_tasks')
          .update({
            completed: true,
            completed_at: completedAt,
            completed_by: adminId,
          })
          .in('id', tasks.map((t) => t.id));

        if (completeError) {
          console.error(`Error completing tasks for landlord ${landlordId}:`, completeError);
        }

        // Log activity for each landlord
        await this.logActivity(adminId, landlordId, 'onboarding_completed', null);
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.ONBOARDING_TASK_COMPLETED,
          entityType: ENTITY_TYPES.LANDLORD,
          entityId: landlordId,
          metadata: {
            bulk_completed: 'true',
            all_tasks: 'true',
          },
        });
      }
    }

    return { success: true, count: landlordIds.length };
  },

  /**
   * Get onboarding statistics
   */
  async getStats() {
    const { data: pending, error: pendingError } = await supabase
      .from('landlords')
      .select('id', { count: 'exact' })
      .eq('onboarding_status', 'pending');

    const { data: completed, error: completedError } = await supabase
      .from('landlords')
      .select('id', { count: 'exact' })
      .eq('onboarding_status', 'active')
      .not('onboarding_completed_at', 'is', null);

    if (pendingError) throw pendingError;
    if (completedError) throw completedError;

    return {
      pending: pending?.length || 0,
      completed: completed?.length || 0,
    };
  },
};

export default onboardingService;

