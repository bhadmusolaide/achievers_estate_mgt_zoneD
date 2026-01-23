import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';

const ApprovalSettingsManager = () => {
  const { adminProfile } = useAuth();
  const [settings, setSettings] = useState({
    threshold: 50000,
    roles: ['chairman', 'treasurer'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  // Available roles for selection
  const availableRoles = [
    { value: 'chairman', label: 'Chairman', description: 'Full administrative access' },
    { value: 'treasurer', label: 'Treasurer', description: 'Financial management' },
    { value: 'secretary', label: 'Secretary', description: 'Record keeping and coordination' },
    { value: 'officer', label: 'Officer', description: 'General administrative tasks' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsService.getApprovalSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading approval settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setSettings(prev => ({ ...prev, threshold: value }));
    if (errors.threshold) {
      setErrors(prev => ({ ...prev, threshold: '' }));
    }
  };

  const handleRoleToggle = (role) => {
    setSettings(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
    if (errors.roles) {
      setErrors(prev => ({ ...prev, roles: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!settings.threshold || settings.threshold <= 0) {
      newErrors.threshold = 'Approval threshold must be a positive number';
    }

    if (!settings.roles || settings.roles.length === 0) {
      newErrors.roles = 'At least one role must be selected for approval';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!validate()) return;

    setSaving(true);
    try {
      await settingsService.updateApprovalSettings(settings.threshold, settings.roles);
      setMessage({ type: 'success', text: 'Approval settings updated successfully' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving approval settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spin" size={24} />
        <span>Loading approval settings...</span>
      </div>
    );
  }

  return (
    <div className="approval-settings-manager">
      <div className="section-header">
        <div>
          <h3>Approval Settings</h3>
          <p className="section-description">
            Configure the approval threshold and roles that can approve transactions.
            Transactions above the threshold will require approval from authorized roles.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`${message.type}-message`} style={{ marginBottom: '1rem' }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="approval-settings-form">
        <div className="form-card">
          <div className="form-group">
            <label htmlFor="threshold">Approval Threshold (₦) *</label>
            <input
              type="number"
              id="threshold"
              value={settings.threshold}
              onChange={handleThresholdChange}
              placeholder="50000"
              min="1"
              step="1000"
              className={errors.threshold ? 'error' : ''}
              disabled={saving}
            />
            <small className="help-text">
              Debit transactions above this amount will require approval
            </small>
            {errors.threshold && <span className="error-text">{errors.threshold}</span>}
          </div>

          <div className="form-group">
            <label>Approval Roles *</label>
            <p className="help-text">Select which roles can approve pending transactions:</p>
            <div className="roles-checkboxes">
              {availableRoles.map(role => (
                <label key={role.value} className="role-checkbox-item">
                  <input
                    type="checkbox"
                    checked={settings.roles.includes(role.value)}
                    onChange={() => handleRoleToggle(role.value)}
                    disabled={saving}
                  />
                  <div className="role-info">
                    <span className="role-label">{role.label}</span>
                    <span className="role-description">{role.description}</span>
                  </div>
                </label>
              ))}
            </div>
            {errors.roles && <span className="error-text">{errors.roles}</span>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="spin" size={18} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ApprovalSettingsManager;