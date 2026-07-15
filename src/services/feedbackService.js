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

  async submit({ name, email, phone, category, message }) {
    const { error } = await supabase
      .from('feedback')
      .insert({ name, email, phone, category, message });

    if (error) throw error;
  },
};

export default feedbackService;