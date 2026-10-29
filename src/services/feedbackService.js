import { supabase } from '../lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export const feedbackService = {
  async list() {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getUnreadCount() {
    const { count, error } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  async markAsRead(ids) {
    const { error } = await supabase
      .from('feedback')
      .update({ is_read: true })
      .in('id', ids);
    if (error) throw error;
  },

  async submit({ name, email, phone, category, message }) {
    const baseUrl = (supabaseUrl || '').replace(/\/$/, '');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${baseUrl}/functions/v1/submit-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ name, email, phone, category, message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to submit');
  },
};

export default feedbackService;
