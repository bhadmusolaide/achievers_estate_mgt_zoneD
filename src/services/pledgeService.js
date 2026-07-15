import { supabase } from '../lib/supabase';

export const pledgeService = {
  async getAll() {
    const { data, error } = await supabase
      .from('pledges')
      .select(`
        *,
        landlords (id, title, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('pledges')
      .select(`
        *,
        landlords (id, title, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(pledge) {
    const { data, error } = await supabase
      .from('pledges')
      .insert([{
        donor_name: pledge.donor_name,
        landlord_id: pledge.landlord_id || null,
        amount: pledge.amount,
        description: pledge.description || null,
        status: pledge.status || 'pending',
        created_by: pledge.created_by || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('pledges')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase
      .from('pledges')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async getStatusOptions() {
    return [
      { value: 'pending', label: 'Pending' },
      { value: 'partial', label: 'Partial' },
      { value: 'fulfilled', label: 'Fulfilled' },
    ];
  },
};

export default pledgeService;
