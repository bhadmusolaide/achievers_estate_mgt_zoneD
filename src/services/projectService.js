import { supabase } from '../lib/supabase';

export const projectService = {
  async getAll() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(project) {
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: project.name,
        description: project.description || null,
        estimated_budget: project.estimated_budget || 0,
        milestone_level: project.milestone_level || 'open',
        created_by: project.created_by || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('projects')
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
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async getMilestoneOptions() {
    return [
      { value: 'open', label: 'Open' },
      { value: 'awaiting_funding', label: 'Awaiting Funding' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'pending', label: 'Pending' },
      { value: 'canceled', label: 'Canceled' },
      { value: 'completed', label: 'Completed' },
    ];
  },
};

export default projectService;
