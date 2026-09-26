import { supabase } from '../lib/supabase';
import { messagingService } from './messagingService';

const ESTATE_NAME = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';

const computeDaysFromDate = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  return Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const formatCelebrationList = (celebrations) => {
  const grouped = { today: [], tomorrow: [], upcoming: [] };
  celebrations.forEach((c) => {
    const landlord = c.landlords;
    const name = landlord ? `${landlord.title || ''} ${landlord.full_name || ''}`.trim() : 'Unknown';
    const label = c.celebration_type === 'birthday' ? 'Birthday' : 'Anniversary';
    const entry = `• ${name} — ${label}`;
    const daysToEvent = computeDaysFromDate(c.celebration_date);

    if (daysToEvent === 0) grouped.today.push(entry);
    else if (daysToEvent === 1) grouped.tomorrow.push(entry);
    else grouped.upcoming.push(`${entry} (${daysToEvent} days away)`);
  });
  return grouped;
};

const buildReminderMessage = (celebrations) => {
  const grouped = formatCelebrationList(celebrations);
  const parts = [];

  if (grouped.today.length > 0) {
    parts.push(`🔔 TODAY'S CELEBRATIONS:\n${grouped.today.join('\n')}`);
  }
  if (grouped.tomorrow.length > 0) {
    parts.push(`\n📅 TOMORROW'S CELEBRATIONS:\n${grouped.tomorrow.join('\n')}`);
  }
  if (grouped.upcoming.length > 0) {
    parts.push(`\n📆 UPCOMING:\n${grouped.upcoming.join('\n')}`);
  }

  return parts.length > 0
    ? parts.join('\n\n')
    : null;
};

export const celebrationReminderService = {
  /**
   * Check if reminders were already sent today for this admin.
   * Uses a localStorage simple check (since reminders fire client-side).
   * Falls back to a DB check via the admin_profiles.last_reminder_sent field.
   */
  async wasReminderSentToday(adminId) {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `celebration_reminder_sent_${adminId}`;
    if (localStorage.getItem(storageKey) === today) return true;

    const { data } = await supabase
      .from('admin_profiles')
      .select('celebration_reminder_last_sent')
      .eq('id', adminId)
      .single();

    if (data?.celebration_reminder_last_sent) {
      const lastSent = data.celebration_reminder_last_sent.split('T')[0];
      if (lastSent === today) {
        localStorage.setItem(storageKey, today);
        return true;
      }
    }
    return false;
  },

  /**
   * Mark reminder as sent for today for this admin.
   */
  async markReminderSent(adminId) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`celebration_reminder_sent_${adminId}`, today);

    await supabase
      .from('admin_profiles')
      .update({ celebration_reminder_last_sent: new Date().toISOString() })
      .eq('id', adminId);
  },

  /**
   * Fetch pending celebrations that are due today, tomorrow, or within 3 days.
   */
  async getPendingCelebrations() {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('celebrations_queue')
      .select(`
        id,
        celebration_type,
        celebration_date,
        status,
        landlords (
          id,
          title,
          full_name,
          phone,
          email
        )
      `)
      .in('status', ['pending', 'approved'])
      .gte('celebration_date', today)
      .lte('celebration_date', threeDaysOut)
      .order('celebration_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Send celebration reminder email to the current admin.
   * Only sends if:
   * - There are pending/approved celebrations within the next 3 days
   * - The admin has email_celebration_reminders enabled
   * - Reminder hasn't been sent today already
   *
   * @param {Object} adminProfile - Admin profile with id, email, full_name
   * @param {boolean} [force=false] - If true, bypass the already-sent check (for testing)
   */
  async sendAdminReminder(adminProfile, force = false) {
    if (!adminProfile?.id || !adminProfile?.email) {
      return { sent: false, reason: 'No admin email available' };
    }

    try {
      const [alreadySent, preferences] = await Promise.all([
        this.wasReminderSentToday(adminProfile.id),
        supabase
          .from('admin_profiles')
          .select('notification_preferences')
          .eq('id', adminProfile.id)
          .single(),
      ]);

      const prefs = preferences?.data?.notification_preferences || {};
      if (prefs.email_celebration_reminders === false) {
        return { sent: false, reason: 'Reminders disabled in settings' };
      }

      if (!force && alreadySent) {
        return { sent: false, reason: 'Already sent today' };
      }

      const celebrations = await this.getPendingCelebrations();
      if (celebrations.length === 0) {
        return { sent: false, reason: 'No pending celebrations' };
      }

      const message = buildReminderMessage(celebrations);
      if (!message) {
        return { sent: false, reason: 'No valid celebrations to remind about' };
      }

      const adminName = adminProfile.full_name || 'Admin';
      const totalCount = celebrations.length;
      const subject = `🎉 Celebration Reminder — ${totalCount} celebration${totalCount !== 1 ? 's' : ''} pending`;

      const result = await messagingService.sendNotificationEmail(
        adminProfile.email,
        adminName,
        subject,
        message,
        {
          celebration_count: totalCount,
          estate_name: ESTATE_NAME,
        },
      );

      if (result.success) {
        await this.markReminderSent(adminProfile.id);
        return { sent: true };
      }

      return { sent: false, reason: result.error || 'Email send failed' };
    } catch (error) {
      console.error('Celebration reminder error:', error);
      return { sent: false, reason: error.message };
    }
  },
};

export default celebrationReminderService;
