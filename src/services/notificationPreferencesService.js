import { supabase } from '../lib/supabase';

// Default notification preferences
export const DEFAULT_PREFERENCES = {
  email_new_payments: true,
  email_payment_confirmations: true,
  email_celebration_reminders: true,
  dashboard_alerts: true,
};

export const notificationPreferencesService = {
  /**
   * Get notification preferences for an admin
   */
  async getPreferences(adminId) {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('notification_preferences')
        .eq('id', adminId)
        .single();

      if (error) throw error;

      // Merge with defaults to ensure all keys exist
      return {
        ...DEFAULT_PREFERENCES,
        ...(data?.notification_preferences || {}),
      };
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  },

  /**
   * Update notification preferences for an admin
   */
  async updatePreferences(adminId, preferences) {
    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .update({ notification_preferences: preferences })
        .eq('id', adminId)
        .select('notification_preferences')
        .single();

      if (error) throw error;
      return { success: true, data: data.notification_preferences };
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update a single preference
   */
  async updateSinglePreference(adminId, key, value) {
    try {
      // First get current preferences
      const currentPrefs = await this.getPreferences(adminId);
      
      // Update the specific preference
      const updatedPrefs = {
        ...currentPrefs,
        [key]: value,
      };

      return await this.updatePreferences(adminId, updatedPrefs);
    } catch (error) {
      console.error('Error updating single preference:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if a specific notification is enabled for an admin
   */
  async isNotificationEnabled(adminId, notificationType) {
    try {
      const preferences = await this.getPreferences(adminId);
      return preferences[notificationType] ?? true;
    } catch (error) {
      console.error('Error checking notification preference:', error);
      return true; // Default to enabled
    }
  },
};

export default notificationPreferencesService;

