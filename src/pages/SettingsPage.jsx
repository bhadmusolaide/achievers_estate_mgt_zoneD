import { useState, useEffect, useRef } from 'react';
import { Save, User, Bell, Shield, Mail, MessageSquare, Loader2, CheckCircle, AlertCircle, Send, Info, Users, Tag, CheckSquare } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { messagingConfigService } from '../services/messagingConfigService';
import { notificationPreferencesService, DEFAULT_PREFERENCES } from '../services/notificationPreferencesService';
import UserManagement from '../components/settings/UserManagement';
import TransactionCategoriesManager from '../components/settings/TransactionCategoriesManager';
import ApprovalSettingsManager from '../components/settings/ApprovalSettingsManager';

const SettingsPage = () => {
  const { adminProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState({ type: '', text: '' });
  const prefsLoadedRef = useRef(false);

  // Messaging test state
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [whatsAppTestResult, setWhatsAppTestResult] = useState(null);

  // Load notification preferences on mount
  useEffect(() => {
    if (adminProfile?.id && !prefsLoadedRef.current) {
      prefsLoadedRef.current = true;
      loadNotificationPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminProfile?.id]);

  const loadNotificationPreferences = async () => {
    setLoadingPrefs(true);
    try {
      const prefs = await notificationPreferencesService.getPreferences(adminProfile.id);
      setNotificationPrefs(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    // Optimistically update UI
    setNotificationPrefs(prev => ({ ...prev, [key]: value }));
    setSavingPrefs(true);
    setPrefsMessage({ type: '', text: '' });

    try {
      const result = await notificationPreferencesService.updateSinglePreference(
        adminProfile.id,
        key,
        value
      );

      if (result.success) {
        setPrefsMessage({ type: 'success', text: 'Preference saved' });
        setTimeout(() => setPrefsMessage({ type: '', text: '' }), 2000);
      } else {
        // Revert on failure
        setNotificationPrefs(prev => ({ ...prev, [key]: !value }));
        setPrefsMessage({ type: 'error', text: 'Failed to save preference' });
      }
    } catch {
      // Revert on error
      setNotificationPrefs(prev => ({ ...prev, [key]: !value }));
      setPrefsMessage({ type: 'error', text: 'Failed to save preference' });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setEmailTestResult({ success: false, error: 'Please enter an email address' });
      return;
    }
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const result = await messagingConfigService.testEmailConfig(testEmail);
      setEmailTestResult(result);
    } catch (error) {
      setEmailTestResult({ success: false, error: error.message });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      setWhatsAppTestResult({ success: false, error: 'Please enter a phone number' });
      return;
    }
    setTestingWhatsApp(true);
    setWhatsAppTestResult(null);
    try {
      const result = await messagingConfigService.testWhatsAppConfig(testPhone);
      setWhatsAppTestResult(result);
    } catch (error) {
      setWhatsAppTestResult({ success: false, error: error.message });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const isChairman = adminProfile?.role === 'chairman';

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare },
    { id: 'security', label: 'Security', icon: Shield },
    // Chairman-only tabs
    ...(isChairman ? [
      { id: 'users', label: 'User Management', icon: Users },
      { id: 'categories', label: 'Transaction Categories', icon: Tag },
      { id: 'approvals', label: 'Approval Settings', icon: CheckSquare },
    ] : []),
  ];

  return (
    <div className="page settings-page">
      <Header title="Settings" />
      
      <div className="page-content">
        <div className="settings-layout">
          <div className="settings-sidebar">
            <nav className="settings-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="settings-content">
            {activeTab === 'profile' && (
              <div className="settings-section">
                <h3>Profile Settings</h3>
                <p className="section-description">Manage your account information</p>
                
                <form className="form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      defaultValue={adminProfile?.full_name}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <input 
                      type="text" 
                      defaultValue={adminProfile?.role}
                      disabled
                      className="capitalize"
                    />
                  </div>
                  <div className="form-group">
                    <label>Zone</label>
                    <input 
                      type="text" 
                      defaultValue={adminProfile?.zone}
                      disabled
                    />
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-section">
                <h3>Notification Settings</h3>
                <p className="section-description">Configure how you receive notifications and alerts</p>

                {prefsMessage.text && (
                  <div className={`${prefsMessage.type}-message`} style={{ marginBottom: '1rem' }}>
                    {prefsMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span>{prefsMessage.text}</span>
                  </div>
                )}

                {loadingPrefs ? (
                  <div className="loading-state">
                    <Loader2 className="spin" size={24} />
                    <span>Loading preferences...</span>
                  </div>
                ) : (
                  <div className="settings-options">
                    <div className="option-item">
                      <div>
                        <label>New Payment Alerts</label>
                        <p>Receive email notifications when new payments are logged</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={notificationPrefs.email_new_payments}
                          onChange={(e) => handlePreferenceChange('email_new_payments', e.target.checked)}
                          disabled={savingPrefs}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="option-item">
                      <div>
                        <label>Payment Confirmation Alerts</label>
                        <p>Get notified when payments are confirmed by admins</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={notificationPrefs.email_payment_confirmations}
                          onChange={(e) => handlePreferenceChange('email_payment_confirmations', e.target.checked)}
                          disabled={savingPrefs}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="option-item">
                      <div>
                        <label>Celebration Reminders</label>
                        <p>Get email reminders for upcoming birthdays and anniversaries</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={notificationPrefs.email_celebration_reminders}
                          onChange={(e) => handlePreferenceChange('email_celebration_reminders', e.target.checked)}
                          disabled={savingPrefs}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="option-item">
                      <div>
                        <label>Dashboard Alerts</label>
                        <p>Show alert banners on the dashboard for pending actions</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={notificationPrefs.dashboard_alerts}
                          onChange={(e) => handlePreferenceChange('dashboard_alerts', e.target.checked)}
                          disabled={savingPrefs}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="info-box" style={{ marginTop: '1.5rem' }}>
                  <Info size={18} />
                  <div>
                    <strong>Note:</strong>
                    <p>Email notifications require SMTP to be configured in the Messaging settings. Dashboard alerts are shown directly in the app.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'messaging' && (
              <div className="settings-section">
                <h3>Messaging Configuration</h3>
                <p className="section-description">Configure and test email and WhatsApp messaging</p>

                {/* Email Configuration */}
                <div className="messaging-config-card">
                  <div className="config-header">
                    <Mail size={24} />
                    <div>
                      <h4>Email (SMTP)</h4>
                      <p>Send receipts and notifications via email</p>
                    </div>
                  </div>

                  <div className="info-box">
                    <Info size={18} />
                    <div>
                      <strong>Configuration Required:</strong>
                      <p>Email sending requires SMTP credentials to be configured in Supabase Edge Functions.</p>
                      <p className="mt-2"><strong>Required environment variables:</strong></p>
                      <ul className="config-list">
                        <li><code>SMTP_HOST</code> - SMTP server (e.g., smtp.gmail.com)</li>
                        <li><code>SMTP_PORT</code> - SMTP port (e.g., 587)</li>
                        <li><code>SMTP_USER</code> - Email address</li>
                        <li><code>SMTP_PASS</code> - App password or SMTP password</li>
                      </ul>
                    </div>
                  </div>

                  <div className="test-section">
                    <h5>Test Email Configuration</h5>
                    <div className="test-form">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="Enter test email address"
                        disabled={testingEmail}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleTestEmail}
                        disabled={testingEmail}
                      >
                        {testingEmail ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                        Send Test
                      </button>
                    </div>
                    {emailTestResult && (
                      <div className={`test-result ${emailTestResult.success ? 'success' : 'error'}`}>
                        {emailTestResult.success ? (
                          <>
                            <CheckCircle size={18} />
                            <span>Email sent successfully! Check your inbox.</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} />
                            <span>{emailTestResult.error}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* WhatsApp Configuration */}
                <div className="messaging-config-card">
                  <div className="config-header">
                    <MessageSquare size={24} />
                    <div>
                      <h4>WhatsApp Cloud API</h4>
                      <p>Send receipts and celebrations via WhatsApp</p>
                    </div>
                  </div>

                  <div className="info-box">
                    <Info size={18} />
                    <div>
                      <strong>Configuration Required:</strong>
                      <p>WhatsApp messaging requires Meta Business API credentials in Supabase Edge Functions.</p>
                      <p className="mt-2"><strong>Required environment variables:</strong></p>
                      <ul className="config-list">
                        <li><code>WHATSAPP_API_URL</code> - Graph API URL (https://graph.facebook.com/v17.0)</li>
                        <li><code>WHATSAPP_PHONE_NUMBER_ID</code> - Your WhatsApp Business phone number ID</li>
                        <li><code>WHATSAPP_ACCESS_TOKEN</code> - Permanent access token</li>
                      </ul>
                      <p className="mt-2">
                        <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                           target="_blank"
                           rel="noopener noreferrer"
                           className="link">
                          View WhatsApp Cloud API Setup Guide →
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="test-section">
                    <h5>Test WhatsApp Configuration</h5>
                    <div className="test-form">
                      <input
                        type="tel"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="Enter phone number (e.g., 08012345678)"
                        disabled={testingWhatsApp}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleTestWhatsApp}
                        disabled={testingWhatsApp}
                      >
                        {testingWhatsApp ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                        Send Test
                      </button>
                    </div>
                    {whatsAppTestResult && (
                      <div className={`test-result ${whatsAppTestResult.success ? 'success' : 'error'}`}>
                        {whatsAppTestResult.success ? (
                          <>
                            <CheckCircle size={18} />
                            <span>WhatsApp message sent successfully!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={18} />
                            <span>{whatsAppTestResult.error}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Setup Instructions */}
                <div className="setup-instructions">
                  <h4>How to Configure Messaging</h4>
                  <ol>
                    <li>
                      <strong>Deploy Supabase Edge Functions:</strong>
                      <code>supabase functions deploy send-email</code>
                      <code>supabase functions deploy send-whatsapp</code>
                    </li>
                    <li>
                      <strong>Set Environment Variables:</strong>
                      <p>Go to your Supabase project dashboard → Edge Functions → Select function → Configuration</p>
                    </li>
                    <li>
                      <strong>Test Configuration:</strong>
                      <p>Use the test forms above to verify your setup</p>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-section">
                <h3>Security Settings</h3>
                <p className="section-description">Manage your account security</p>

                <form className="form" onSubmit={handlePasswordSubmit}>
                  {passwordError && (
                    <div className="error-message">
                      <AlertCircle size={18} />
                      <span>{passwordError}</span>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="success-message">
                      <CheckCircle size={18} />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter current password"
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter new password"
                      disabled={saving}
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                      disabled={saving}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                    Update Password
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'users' && isChairman && (
              <div className="settings-section">
                <UserManagement />
              </div>
            )}

            {activeTab === 'categories' && isChairman && (
              <div className="settings-section">
                <TransactionCategoriesManager />
              </div>
            )}

            {activeTab === 'approvals' && isChairman && (
              <div className="settings-section">
                <ApprovalSettingsManager />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

