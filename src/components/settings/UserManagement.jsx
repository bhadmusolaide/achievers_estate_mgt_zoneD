import { useState, useEffect } from 'react';
import { Users, Shield, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, UserPlus, X, Eye, EyeOff } from 'lucide-react';
import { userPermissionsService, FEATURE_DEFINITIONS, DEFAULT_PERMISSIONS } from '../../services/userPermissionsService';

const UserManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'officer',
    zone: 'Zone D',
  });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userPermissionsService.getAllAdmins();
      setAdmins(data);
    } catch (err) {
      console.error('Error loading admins:', err);
      setError('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (adminId, featureKey, currentValue) => {
    const savingKey = `${adminId}-${featureKey}`;
    setSaving(prev => ({ ...prev, [savingKey]: true }));
    setMessage({ type: '', text: '' });

    try {
      const result = await userPermissionsService.updateSinglePermission(
        adminId,
        featureKey,
        !currentValue
      );

      if (result.success) {
        // Update local state
        setAdmins(prev => prev.map(admin => {
          if (admin.id === adminId) {
            return { ...admin, feature_permissions: result.permissions };
          }
          return admin;
        }));
        setMessage({ type: 'success', text: 'Permission updated' });
        setTimeout(() => setMessage({ type: '', text: '' }), 2000);
      }
    } catch (err) {
      console.error('Error updating permission:', err);
      setMessage({ type: 'error', text: 'Failed to update permission' });
    } finally {
      setSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const toggleUserExpand = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const getRoleBadgeClass = (role) => {
    const classes = {
      chairman: 'badge-primary',
      secretary: 'badge-info',
      treasurer: 'badge-success',
      officer: 'badge-default',
    };
    return classes[role] || 'badge-default';
  };

  const handleCreateFormChange = (e) => {
    const { name, value } = e.target;
    setCreateForm(prev => ({ ...prev, [name]: value }));
    setCreateError('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');

    // Validation
    if (!createForm.full_name.trim()) {
      setCreateError('Full name is required');
      return;
    }
    if (!createForm.email.trim()) {
      setCreateError('Email is required');
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }

    setCreating(true);
    try {
      const result = await userPermissionsService.createAdminUser(createForm);

      if (result.success) {
        // Reload admins list
        await loadAdmins();
        // Reset form and close modal
        setCreateForm({
          full_name: '',
          email: '',
          password: '',
          role: 'officer',
          zone: 'Zone D',
        });
        setShowCreateModal(false);
        setMessage({ type: 'success', text: 'Admin user created successfully' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      full_name: '',
      email: '',
      password: '',
      role: 'officer',
      zone: 'Zone D',
    });
    setCreateError('');
    setShowPassword(false);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spin" size={24} />
        <span>Loading admin users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={24} />
        <span>{error}</span>
        <button className="btn btn-secondary" onClick={loadAdmins}>Retry</button>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <div>
          <h3>User Management</h3>
          <p className="section-description">
            Control which features each admin can access. Chairman always has full access.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={18} />
          Add Admin
        </button>
      </div>

      {message.text && (
        <div className={`${message.type}-message`} style={{ marginBottom: '1rem' }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="user-list">
        {admins.map((admin) => {
          const isChairman = admin.role === 'chairman';
          const isExpanded = expandedUser === admin.id;
          const permissions = admin.feature_permissions || DEFAULT_PERMISSIONS;

          return (
            <div key={admin.id} className={`user-card ${isExpanded ? 'expanded' : ''}`}>
              <div
                className="user-card-header"
                onClick={() => !isChairman && toggleUserExpand(admin.id)}
                style={{ cursor: isChairman ? 'default' : 'pointer' }}
              >
                <div className="user-info-row">
                  <div className="user-avatar-sm">
                    {admin.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="user-details-col">
                    <span className="user-name">{admin.full_name}</span>
                    <span className="user-email">{admin.email || 'No email'}</span>
                  </div>
                </div>
                <div className="user-card-actions">
                  <span className={`badge ${getRoleBadgeClass(admin.role)}`}>
                    {admin.role}
                  </span>
                  {isChairman ? (
                    <span className="full-access-badge">
                      <Shield size={14} />
                      Full Access
                    </span>
                  ) : (
                    <button className="expand-btn">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && !isChairman && (
                <div className="user-permissions">
                  <h4>Feature Access</h4>
                  <div className="permissions-grid">
                    {FEATURE_DEFINITIONS.map((feature) => {
                      const savingKey = `${admin.id}-${feature.key}`;
                      const isEnabled = permissions[feature.key] !== false;
                      const isSaving = saving[savingKey];

                      return (
                        <div key={feature.key} className="permission-item">
                          <div className="permission-info">
                            <span className="permission-label">{feature.label}</span>
                            <span className="permission-desc">{feature.description}</span>
                          </div>
                          <label className={`toggle-switch ${feature.protected ? 'protected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => handlePermissionToggle(admin.id, feature.key, isEnabled)}
                              disabled={isSaving || feature.protected}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal-content create-admin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Admin User</h3>
              <button className="close-btn" onClick={closeCreateModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              {createError && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={18} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="full_name">Full Name *</label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={createForm.full_name}
                  onChange={handleCreateFormChange}
                  placeholder="Enter full name"
                  className="form-control"
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={createForm.email}
                  onChange={handleCreateFormChange}
                  placeholder="Enter email address"
                  className="form-control"
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={createForm.password}
                    onChange={handleCreateFormChange}
                    placeholder="Minimum 6 characters"
                    className="form-control"
                    disabled={creating}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  name="role"
                  value={createForm.role}
                  onChange={handleCreateFormChange}
                  className="form-control"
                  disabled={creating}
                >
                  <option value="officer">Officer</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="secretary">Secretary</option>
                </select>
                <p className="form-hint">Chairman role cannot be assigned through this form.</p>
              </div>

              <div className="form-group">
                <label htmlFor="zone">Zone</label>
                <input
                  type="text"
                  id="zone"
                  name="zone"
                  value={createForm.zone}
                  onChange={handleCreateFormChange}
                  placeholder="Zone D"
                  className="form-control"
                  disabled={creating}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeCreateModal}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="spin" size={18} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Create Admin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

