import { supabase } from '../lib/supabase';

// Default permissions - all features enabled
export const DEFAULT_PERMISSIONS = {
  dashboard: true,
  landlords: true,
  onboarding: true,
  bulk_import: true,
  payments: true,
  receipts: true,
  financial_overview: true,
  celebrations: true,
  audit_log: true,
  settings: true,
};

// Feature definitions with labels and descriptions
export const FEATURE_DEFINITIONS = [
  { key: 'dashboard', label: 'Dashboard', description: 'View dashboard and metrics', protected: true },
  { key: 'landlords', label: 'Landlords', description: 'View and manage landlord records', protected: true },
  { key: 'onboarding', label: 'Onboarding', description: 'Manage landlord onboarding process' },
  { key: 'bulk_import', label: 'Bulk Import', description: 'Import landlords from CSV files' },
  { key: 'payments', label: 'Payments', description: 'View and manage payments', protected: true },
  { key: 'receipts', label: 'Receipts', description: 'View and generate receipts' },
  { key: 'financial_overview', label: 'Financial Overview', description: 'View financial reports and summaries' },
  { key: 'celebrations', label: 'Celebrations', description: 'Manage birthday and anniversary celebrations' },
  { key: 'audit_log', label: 'Audit Log', description: 'View system activity logs' },
  { key: 'settings', label: 'Settings', description: 'Access settings page', protected: true },
];

// Map route paths to permission keys
export const ROUTE_TO_PERMISSION = {
  '/dashboard': 'dashboard',
  '/landlords': 'landlords',
  '/onboarding': 'onboarding',
  '/bulk-import': 'bulk_import',
  '/payments': 'payments',
  '/receipts': 'receipts',
  '/financial-overview': 'financial_overview',
  '/celebrations': 'celebrations',
  '/audit-log': 'audit_log',
  '/settings': 'settings',
};

export const userPermissionsService = {
  /**
   * Get all admin users with their permissions (for chairman only)
   */
  async getAllAdmins() {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('id, full_name, role, email, feature_permissions')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) throw error;
    
    // Ensure all admins have permissions object
    return data.map(admin => ({
      ...admin,
      feature_permissions: admin.feature_permissions || DEFAULT_PERMISSIONS,
    }));
  },

  /**
   * Update permissions for a specific admin user
   */
  async updatePermissions(adminId, permissions) {
    const { error } = await supabase
      .from('admin_profiles')
      .update({ feature_permissions: permissions })
      .eq('id', adminId);

    if (error) throw error;
    return { success: true };
  },

  /**
   * Update a single permission for an admin user
   */
  async updateSinglePermission(adminId, featureKey, enabled) {
    // First get current permissions
    const { data: admin, error: fetchError } = await supabase
      .from('admin_profiles')
      .select('feature_permissions')
      .eq('id', adminId)
      .single();

    if (fetchError) throw fetchError;

    const currentPermissions = admin.feature_permissions || DEFAULT_PERMISSIONS;
    const updatedPermissions = { ...currentPermissions, [featureKey]: enabled };

    const { error } = await supabase
      .from('admin_profiles')
      .update({ feature_permissions: updatedPermissions })
      .eq('id', adminId);

    if (error) throw error;
    return { success: true, permissions: updatedPermissions };
  },

  /**
   * Check if a user has access to a specific feature
   */
  hasPermission(adminProfile, featureKey) {
    // Chairman always has full access
    if (adminProfile?.role === 'chairman') return true;
    
    const permissions = adminProfile?.feature_permissions || DEFAULT_PERMISSIONS;
    return permissions[featureKey] !== false;
  },

  /**
   * Check if a user can access a specific route
   */
  canAccessRoute(adminProfile, path) {
    const featureKey = ROUTE_TO_PERMISSION[path];
    if (!featureKey) return true; // Unknown routes are allowed
    return this.hasPermission(adminProfile, featureKey);
  },

  /**
   * Get accessible navigation items for a user
   */
  getAccessibleNavItems(adminProfile, navItems) {
    // Chairman sees everything
    if (adminProfile?.role === 'chairman') return navItems;

    const permissions = adminProfile?.feature_permissions || DEFAULT_PERMISSIONS;

    return navItems.filter(item => {
      const featureKey = ROUTE_TO_PERMISSION[item.to];
      if (!featureKey) return true;
      return permissions[featureKey] !== false;
    });
  },

  /**
   * Create a new admin user (chairman only)
   */
  async createAdminUser({ full_name, email, password, role, zone = 'Zone D' }) {
    const { data, error } = await supabase.functions.invoke('create-admin-user', {
      body: { full_name, email, password, role, zone }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;
  },

  /**
   * Delete an admin user (chairman only)
   */
  async deleteAdminUser(adminId) {
    const { data, error } = await supabase.functions.invoke('delete-admin-user', {
      body: { admin_id: adminId }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;
  },
};

export default userPermissionsService;

