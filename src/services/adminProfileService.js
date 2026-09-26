import { supabase } from '../lib/supabase';

export const adminProfileService = {
  async updateProfile(adminId, { full_name, email, zone }) {
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (email !== undefined) updates.email = email;
    if (zone !== undefined) updates.zone = zone;

    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    const { error } = await supabase
      .from('admin_profiles')
      .update(updates)
      .eq('id', adminId);

    if (error) throw error;

    if (email) {
      const { error: authError } = await supabase.auth.updateUser({ email });
      if (authError) throw authError;
    }

    return { success: true };
  },
};

export default adminProfileService;