import { supabase } from '../lib/supabase';

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
    const { error } = await supabase
      .from('feedback')
      .insert({ name, email, phone, category, message });

    if (error) throw error;
  },
};

export default feedbackService;