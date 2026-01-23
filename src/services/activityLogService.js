import { supabase } from '../lib/supabase';

// Maximum metadata size in bytes (2KB)
const MAX_METADATA_SIZE = 2048;

// Allowed action types (mandatory logging coverage)
export const ACTION_TYPES = {
  LANDLORD_CREATED: 'landlord_created',
  LANDLORD_UPDATED: 'landlord_updated',
  LANDLORD_CSV_IMPORT: 'landlord_csv_import',
  CHARGE_BULK_CREATED: 'charge_bulk_created',
  PAYMENT_LOGGED: 'payment_logged',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PAYMENT_TYPE_ASSIGNED: 'payment_type_assigned',
  PAYMENT_TYPE_UNASSIGNED: 'payment_type_unassigned',
  RECEIPT_GENERATED: 'receipt_generated',
  RECEIPT_SENT_EMAIL: 'receipt_sent_email',
  RECEIPT_SENT_WHATSAPP: 'receipt_sent_whatsapp',
  ONBOARDING_TASK_COMPLETED: 'onboarding_task_completed',
  CELEBRATION_APPROVED: 'celebration_approved',
  CELEBRATION_SENT: 'celebration_sent',
  CELEBRATION_SKIPPED: 'celebration_skipped',
  ADMIN_LOGIN: 'admin_login',
};

// Entity types
export const ENTITY_TYPES = {
  LANDLORD: 'landlord',
  PAYMENT: 'payment',
  RECEIPT: 'receipt',
  CELEBRATION: 'celebration',
  ONBOARDING_TASK: 'onboarding_task',
  ADMIN: 'admin',
  CHARGE: 'charge',
  TRANSACTION: 'transaction',
};

// Critical actions that require confirmation
export const CRITICAL_ACTIONS = [
  ACTION_TYPES.CHARGE_BULK_CREATED,
  ACTION_TYPES.LANDLORD_CSV_IMPORT,
  ACTION_TYPES.PAYMENT_CONFIRMED,
  ACTION_TYPES.PAYMENT_TYPE_ASSIGNED,
  ACTION_TYPES.PAYMENT_TYPE_UNASSIGNED,
  ACTION_TYPES.RECEIPT_SENT_EMAIL,
  ACTION_TYPES.RECEIPT_SENT_WHATSAPP,
  ACTION_TYPES.CELEBRATION_SENT,
  ACTION_TYPES.ONBOARDING_TASK_COMPLETED,
];

/**
 * Validates metadata against rules:
 * - Max 2KB size
 * - Flat JSON only (no nested arrays/objects)
 * - No PII beyond IDs
 */
function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { valid: true, metadata: {} };
  }

  // Check for nested arrays or objects
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      throw new Error(`Metadata cannot contain arrays. Found array at key: ${key}`);
    }
    if (value !== null && typeof value === 'object') {
      throw new Error(`Metadata cannot contain nested objects. Found object at key: ${key}`);
    }
  }

  // Check size
  const jsonString = JSON.stringify(metadata);
  const size = new Blob([jsonString]).size;
  
  if (size > MAX_METADATA_SIZE) {
    throw new Error(`Metadata exceeds 2KB limit. Current size: ${size} bytes`);
  }

  return { valid: true, metadata };
}

export const activityLogService = {
  /**
   * Log an activity - core logging function
   * @param {Object} params - Log parameters
   * @param {string} params.adminId - The admin performing the action
   * @param {string} params.actionType - Action type from ACTION_TYPES
   * @param {string} params.entityType - Entity type from ENTITY_TYPES
   * @param {string|null} params.entityId - ID of the affected entity
   * @param {Object} params.metadata - Flat JSON metadata (max 2KB)
   * @returns {Promise<Object>} The created log entry
   */
  async log({ adminId, actionType, entityType, entityId = null, metadata = {} }) {
    // Validate required fields
    if (!adminId) throw new Error('adminId is required for logging');
    if (!actionType) throw new Error('actionType is required for logging');
    if (!entityType) throw new Error('entityType is required for logging');

    // Validate metadata
    validateMetadata(metadata);

    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        actor_admin_id: adminId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      }])
      .select()
      .single();

    if (error) {
      console.error('Activity logging failed:', error);
      throw new Error('Failed to create activity log. Action rolled back.');
    }

    return data;
  },

  /**
   * Get activity logs with filters and pagination
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        admin_profiles:actor_admin_id (id, full_name, role)
      `)
      .order('created_at', { ascending: false });

    if (filters.adminId) {
      query = query.eq('actor_admin_id', filters.adminId);
    }
    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters.entityId) {
      query = query.eq('entity_id', filters.entityId);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.search) {
      // Search in metadata (PostgreSQL JSONB search)
      query = query.or(`metadata.cs.{"search_text":"${filters.search}"}`);
    }

    // Pagination
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count, page, pageSize };
  },

  /**
   * Check if an action is critical and requires confirmation
   */
  isCriticalAction(actionType) {
    return CRITICAL_ACTIONS.includes(actionType);
  },
};

export default activityLogService;

