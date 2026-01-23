import { supabase } from '../lib/supabase';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';

const DAYS_WINDOW = 30; // fallback window to surface upcoming events without the queue

const parseMonthDay = (value) => {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  let month;
  let day;
  if (parts.length === 3) {
    month = parts[1];
    day = parts[2];
  } else if (parts.length === 2) {
    month = parts[0];
    day = parts[1];
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
};

const computeUpcomingEvents = (landlords = [], type, windowDays = DAYS_WINDOW) => {
  const today = new Date();
  const todayYear = today.getFullYear();
  const msPerDay = 24 * 60 * 60 * 1000;

  const results = [];

  landlords.forEach((ll) => {
    const raw = type === 'birthday' ? ll.date_of_birth : ll.wedding_anniversary;
    const parsed = parseMonthDay(raw);
    if (!parsed) return;
    const { month, day } = parsed;

    let eventDate = new Date(todayYear, month - 1, day);
    let delta = Math.floor((eventDate.getTime() - today.getTime()) / msPerDay);

    // If already passed this year, look at next year's occurrence
    if (delta < 0) {
      eventDate = new Date(todayYear + 1, month - 1, day);
      delta = Math.floor((eventDate.getTime() - today.getTime()) / msPerDay);
    }

    if (delta >= 0 && delta <= windowDays) {
      results.push({
        id: `computed-${ll.id}-${type}`,
        landlord_id: ll.id,
        celebration_type: type,
        celebration_date: eventDate.toISOString().split('T')[0],
        days_to_event: delta,
        year: eventDate.getFullYear(),
        status: 'pending',
        computed: true,
        landlords: {
          id: ll.id,
          full_name: ll.full_name,
          phone: ll.phone,
          email: ll.email,
          house_address: ll.house_address,
          road: ll.road,
          zone: ll.zone,
        },
      });
    }
  });

  // Sort soonest first
  return results.sort((a, b) => a.days_to_event - b.days_to_event);
};

export const celebrationService = {
  /**
   * Trigger the server-side celebration check (queues upcoming celebrations).
   * Note: this does NOT send messages, it only populates `celebrations_queue`.
   */
  async runCheck() {
    try {
      const { data, error } = await supabase.functions.invoke('check-celebrations');
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Celebration check function failed, using fallback computation:', error);
      // Return success even if the function fails, as we have fallback mechanisms
      return { success: true, message: 'Function unavailable, using fallback' };
    }
  },

  /**
   * Get all celebrations with filters
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('celebrations_queue')
      .select(`
        *,
        landlords (
          id,
          full_name,
          phone,
          email,
          house_address,
          road,
          zone
        ),
        approved_by_admin:admin_profiles!celebrations_queue_approved_by_fkey (
          full_name
        )
      `)
      .order('celebration_date', { ascending: true })
      .order('days_to_event', { ascending: true });

    if (filters.celebration_type) {
      query = query.eq('celebration_type', filters.celebration_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.year) {
      query = query.eq('year', filters.year);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Get celebrations by type (birthdays or anniversaries)
   */
  async getByType(type, filters = {}) {
    const data = await this.getAll({ ...filters, celebration_type: type });
    if (data && data.length > 0) return data;

    // Fallback: compute directly from landlords without needing the queue/cron
    const { data: landlords, error } = await supabase
      .from('landlords')
      .select('id, full_name, phone, email, house_address, road, zone, date_of_birth, wedding_anniversary, celebrate_opt_in, status, onboarding_status')
      .eq('status', 'active')
      .eq('celebrate_opt_in', true);

    if (error) throw error;

    // Do not block on onboarding; include pending too so users see the event
    const eligible = (landlords || []).filter((ll) => ll.onboarding_status === 'active' || ll.onboarding_status === 'pending' || ll.onboarding_status == null);
    return computeUpcomingEvents(eligible, type);
  },

  /**
   * Get pending celebrations for today and upcoming
   */
  async getPending() {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .select(`
        *,
        landlords (
          id,
          full_name,
          phone,
          email,
          house_address
        )
      `)
      .eq('status', 'pending')
      .order('days_to_event', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Get today's celebrations count by type
   */
  async getTodayCounts() {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('celebrations_queue')
      .select('celebration_type, status')
      .eq('celebration_date', today)
      .in('status', ['pending', 'approved']);

    if (error) throw error;

    const counts = {
      birthdays: data.filter(c => c.celebration_type === 'birthday').length,
      anniversaries: data.filter(c => c.celebration_type === 'anniversary').length,
    };

    // Fallback if queue is empty (e.g., function not run yet)
    if (counts.birthdays === 0 || counts.anniversaries === 0) {
      const { data: landlords } = await supabase
        .from('landlords')
        .select('id, full_name, phone, email, house_address, road, zone, date_of_birth, wedding_anniversary, celebrate_opt_in, status, onboarding_status')
        .eq('status', 'active')
        .eq('celebrate_opt_in', true);
      const eligible = (landlords || []).filter((ll) => ll.onboarding_status === 'active' || ll.onboarding_status === 'pending' || ll.onboarding_status == null);

      const fallbackBirthdays = computeUpcomingEvents(eligible, 'birthday', 0);
      const fallbackAnniversaries = computeUpcomingEvents(eligible, 'anniversary', 0);

      counts.birthdays = counts.birthdays || fallbackBirthdays.length;
      counts.anniversaries = counts.anniversaries || fallbackAnniversaries.length;
    }

    return counts;
  },

  /**
   * Get upcoming celebrations count (next 3 days)
   */
  async getUpcomingCount() {
    const { count, error } = await supabase
      .from('celebrations_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'approved'])
      .gt('days_to_event', 0)
      .lte('days_to_event', 3);

    if (error) throw error;
    return count || 0;
  },

  /**
   * Get a single celebration by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .select(`
        *,
        landlords (*),
        approved_by_admin:admin_profiles!celebrations_queue_approved_by_fkey (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Queue a computed celebration (insert into celebrations_queue)
   */
  async queueCelebration(celebration) {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .insert({
        landlord_id: celebration.landlord_id,
        celebration_type: celebration.celebration_type,
        celebration_date: celebration.celebration_date,
        days_to_event: celebration.days_to_event,
        year: celebration.year,
        status: 'pending',
      })
      .select(`
        *,
        landlords (
          id,
          full_name,
          phone,
          email,
          house_address,
          road,
          zone
        )
      `)
      .single();

    if (error) {
      // If it's a duplicate, try to get the existing one
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('celebrations_queue')
          .select(`
            *,
            landlords (
              id,
              full_name,
              phone,
              email,
              house_address,
              road,
              zone
            )
          `)
          .eq('landlord_id', celebration.landlord_id)
          .eq('celebration_type', celebration.celebration_type)
          .eq('celebration_date', celebration.celebration_date)
          .eq('year', celebration.year)
          .single();
        return existing;
      }
      throw error;
    }

    return data;
  },

  /**
   * Approve a celebration (handles both queued and computed celebrations)
   */
  async approve(id, adminId) {
    // If it's a computed celebration (starts with "computed-"), queue it first
    if (typeof id === 'string' && id.startsWith('computed-')) {
      // This is a computed celebration, we need the full celebration object
      // The CelebrationActions component should pass the full celebration object
      throw new Error('Cannot approve computed celebration without full object. Use approveComputed instead.');
    }

    const { data, error } = await supabase
      .from('celebrations_queue')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    await activityLogService.log({
      adminId,
      actionType: ACTION_TYPES.CELEBRATION_APPROVED,
      entityType: ENTITY_TYPES.CELEBRATION,
      entityId: data.id,
      metadata: {
        celebration_type: data.celebration_type,
        celebration_date: data.celebration_date,
      },
    });

    return data;
  },

  /**
   * Queue and approve a computed celebration in one step
   */
  async approveComputed(celebration, adminId) {
    // First, queue the celebration
    const queued = await this.queueCelebration(celebration);
    
    // Then approve it
    return this.approve(queued.id, adminId);
  },

  /**
   * Mark celebration as sent
   */
  async markSent(id, sentVia, adminId = null) {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_via: sentVia,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    if (adminId) {
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.CELEBRATION_SENT,
        entityType: ENTITY_TYPES.CELEBRATION,
        entityId: data.id,
        metadata: {
          celebration_type: data.celebration_type,
          sent_via: sentVia,
        },
      });
    }

    return data;
  },

  /**
   * Skip a celebration
   */
  async skip(id, reason = '', adminId = null) {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .update({
        status: 'skipped',
        skipped_at: new Date().toISOString(),
        skipped_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    if (adminId) {
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.CELEBRATION_SKIPPED,
        entityType: ENTITY_TYPES.CELEBRATION,
        entityId: data.id,
        metadata: {
          celebration_type: data.celebration_type,
          reason: reason ? reason.substring(0, 100) : 'No reason provided',
        },
      });
    }

    return data;
  },

  /**
   * Update custom message for a celebration
   */
  async updateMessage(id, customMessage) {
    const { data, error } = await supabase
      .from('celebrations_queue')
      .update({ custom_message: customMessage })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get celebration templates
   */
  async getTemplates() {
    const { data, error } = await supabase
      .from('celebration_templates')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get default template by type
   */
  async getDefaultTemplate(celebrationType) {
    const { data, error } = await supabase
      .from('celebration_templates')
      .select('*')
      .eq('celebration_type', celebrationType)
      .eq('is_default', true)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a template
   */
  async updateTemplate(id, updates) {
    const { data, error } = await supabase
      .from('celebration_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export default celebrationService;

