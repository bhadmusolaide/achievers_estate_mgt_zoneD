import { supabase } from '../lib/supabase';

export const settingsService = {
  /**
   * Get a setting value by key
   */
  async getSetting(key, defaultValue = null) {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn(`Could not fetch setting ${key}:`, error);
      return defaultValue;
    }

    if (!data) return defaultValue;

    // Parse JSON if it's a JSON string
    try {
      return JSON.parse(data.value);
    } catch {
      return data.value;
    }
  },

  /**
   * Update or insert a setting
   */
  async updateSetting(key, value, description = '') {
    // Convert value to string if it's an object/array
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key,
        value: stringValue,
        description,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get approval settings
   */
  async getApprovalSettings() {
    const [threshold, roles] = await Promise.all([
      this.getSetting('debit_approval_threshold', 50000),
      this.getSetting('approval_roles', ['chairman', 'treasurer']),
    ]);

    return {
      threshold: parseFloat(threshold),
      roles: Array.isArray(roles) ? roles : ['chairman', 'treasurer'],
    };
  },

  /**
   * Update approval settings
   */
  async updateApprovalSettings(threshold, roles) {
    await Promise.all([
      this.updateSetting('debit_approval_threshold', threshold, 'Minimum amount for debit transactions requiring approval'),
      this.updateSetting('approval_roles', roles, 'Roles authorized to approve transactions'),
    ]);
  },
};

export default settingsService;