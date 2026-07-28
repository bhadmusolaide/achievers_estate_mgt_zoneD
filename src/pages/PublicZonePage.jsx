import { useState, useEffect } from 'react';
import { Wallet, AlertCircle, TrendingDown, Landmark, Building2, CreditCard, Heart, Users, RefreshCw, Home, MessageSquare, Search, Loader2 } from 'lucide-react';
import { publicDashboardService } from '../services/publicDashboardService';
import { formatCurrency, formatDateTime, formatLandlordName } from '../utils/helpers';
import FeedbackModal from '../components/common/FeedbackModal';
import Modal from '../components/common/Modal';

const MILESTONE_LABELS = {
  open: 'Open',
  awaiting_funding: 'Awaiting Funding',
  in_progress: 'In Progress',
  pending: 'Pending',
  canceled: 'Canceled',
  completed: 'Completed',
};

const PLEDGE_STATUS_COLORS = {
  pending: 'badge-warning',
  partial: 'badge-info',
  fulfilled: 'badge-success',
};

const PublicZonePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupForm, setLookupForm] = useState({ phone: '' });
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await publicDashboardService.getPublicData();
      setData(result);
    } catch (error) {
      console.error('Error loading public dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    if (!lookupForm.phone.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    setLookupError('');
    try {
      const result = await publicDashboardService.lookupLandlord(
        lookupForm.phone.trim()
      );
      setLookupResult(result);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const closeLookup = () => {
    setShowLookup(false);
    setLookupForm({ phone: '' });
    setLookupResult(null);
    setLookupError('');
  };

  const handleLookupInputChange = (e) => {
    setLookupForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setLookupError('');
  };

  if (loading) {
    return (
      <div className="page public-zone-page">
        <div className="public-zone-header">
          <div className="public-zone-header-inner">
            <Home size={24} />
            <div>
              <h1>Achievers 1 - Zone D</h1>
              <span>Estate Information Portal</span>
            </div>
          </div>
        </div>
        <div className="page-content" style={{ padding: '2rem' }}>
          <div className="metrics-grid">
            {[1, 2, 3, 4].map(i => <div key={i} className="stats-card loading-skeleton" style={{ height: '100px' }}></div>)}
          </div>
          <div className="zone-card-grid">
            {[1, 2, 3, 4].map(i => <div key={i} className="zone-card loading-skeleton" style={{ height: '300px' }}></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page public-zone-page">
      <div className="public-zone-header">
        <div className="public-zone-header-inner">
          <Home size={24} />
          <div>
            <h1>Achievers 1 - Zone D</h1>
            <span>Estate Information Portal</span>
          </div>
        </div>
        <div className="public-zone-header-actions">
          <button className="btn btn-secondary" onClick={() => setShowLookup(true)}>
            <Search size={18} /> Check My Debt
          </button>
          <button className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </div>
      
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>Welcome to Achievers 1 - Zone D</h2>
            <p>Transparency and community updates at your fingertips</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="metrics-grid">
          <div className={`stats-card stats-card-success`}>
            <div className="stats-icon"><Wallet size={24} /></div>
            <div className="stats-content">
              <span className="stats-value">{formatCurrency(data?.account_balance || 0)}</span>
              <span className="stats-title">Zone Account Balance</span>
            </div>
          </div>
          <div className={`stats-card ${(data?.account_balance || 0) - (data?.total_project_budget || 0) < 0 ? 'stats-card-danger' : 'stats-card-info'}`}>
            <div className="stats-icon"><TrendingDown size={24} /></div>
            <div className="stats-content">
              <span className="stats-value">
                {formatCurrency((data?.account_balance || 0) - (data?.total_project_budget || 0))}
              </span>
              <span className="stats-title">Potential Balance</span>
              {(data?.account_balance || 0) - (data?.total_project_budget || 0) < 0 && (
                <span className="stats-trend negative">Project budgets exceed current balance</span>
              )}
            </div>
          </div>
          <div className={`stats-card stats-card-warning`}>
            <div className="stats-icon"><AlertCircle size={24} /></div>
            <div className="stats-content">
              <span className="stats-value">{formatCurrency(data?.total_outstanding || 0)}</span>
              <span className="stats-title">Total Outstanding</span>
            </div>
          </div>
          <div className={`stats-card stats-card-danger`}>
            <div className="stats-icon"><Landmark size={24} /></div>
            <div className="stats-content">
              <span className="stats-value">{formatCurrency(data?.total_debt || 0)}</span>
              <span className="stats-title">Project Debts</span>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="zone-card-grid">
          {/* Projects Card */}
          <div className="zone-card">
            <div className="zone-card-header">
              <Building2 size={20} />
              <h3>Projects</h3>
              <span className="zone-card-count">{data?.projects?.length || 0}</span>
            </div>
            <div className="zone-card-body">
              {(!data?.projects || data.projects.length === 0) ? (
                <div className="zone-card-empty">No projects yet</div>
              ) : (
                <div className="zone-card-list">
                  {data.projects.map(project => (
                    <div key={project.id} className="zone-card-item">
                      <div className="zone-card-item-main">
                        <span className="zone-item-name">{project.name}</span>
                        <span className={`badge badge-${project.milestone_level === 'completed' ? 'success' : project.milestone_level === 'in_progress' ? 'info' : project.milestone_level === 'awaiting_funding' ? 'warning' : 'default'}`}>
                          {MILESTONE_LABELS[project.milestone_level] || project.milestone_level}
                        </span>
                      </div>
                      <div className="zone-card-item-detail">
                        <span>Budget: {formatCurrency(project.estimated_budget || 0)}</span>
                        {project.description && <span className="zone-item-desc">{project.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Payments Card */}
          <div className="zone-card">
            <div className="zone-card-header">
              <CreditCard size={20} />
              <h3>Recent Payments</h3>
              <span className="zone-card-count">{data?.recent_payments?.length || 0}</span>
            </div>
            <div className="zone-card-body">
              {(!data?.recent_payments || data.recent_payments.length === 0) ? (
                <div className="zone-card-empty">No recent payments</div>
              ) : (
                <div className="zone-card-list">
                  {data.recent_payments.map(payment => (
                    <div key={payment.id} className="zone-card-item">
                      <div className="zone-card-item-main">
                        <span className="zone-item-name">
                          {formatLandlordName(payment.landlord)}
                        </span>
                        <span className="zone-item-amount">{formatCurrency(payment.amount)}</span>
                      </div>
                      <div className="zone-card-item-detail">
                        <span className="capitalize">{payment.payment_type?.name || '-'}</span>
                        <span>{formatDateTime(payment.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pledges Card */}
          <div className="zone-card">
            <div className="zone-card-header">
              <Heart size={20} />
              <h3>Pledges & Donations</h3>
              <span className="zone-card-count">{data?.pledges?.length || 0}</span>
            </div>
            <div className="zone-card-body">
              {(!data?.pledges || data.pledges.length === 0) ? (
                <div className="zone-card-empty">No pledges yet</div>
              ) : (
                <div className="zone-card-list">
                  {data.pledges.map(pledge => (
                    <div key={pledge.id} className="zone-card-item">
                      <div className="zone-card-item-main">
                        <span className="zone-item-name">{pledge.donor_name}</span>
                        <span className="zone-item-amount">{formatCurrency(pledge.amount)}</span>
                      </div>
                      <div className="zone-card-item-detail">
                        <span className={`badge ${PLEDGE_STATUS_COLORS[pledge.status] || 'badge-default'}`}>
                          {pledge.status.charAt(0).toUpperCase() + pledge.status.slice(1)}
                        </span>
                        {pledge.description && <span className="zone-item-desc">{pledge.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Debtors Card */}
          <div className="zone-card">
            <div className="zone-card-header">
              <Users size={20} />
              <h3>Top Debtors</h3>
              <span className="zone-card-count">{data?.top_debtors?.length || 0}</span>
            </div>
            <div className="zone-card-body">
              {(!data?.top_debtors || data.top_debtors.length === 0) ? (
                <div className="zone-card-empty">No outstanding debts</div>
              ) : (
                <div className="zone-card-list">
                  {data.top_debtors.map((debtor, index) => (
                    <div key={debtor.id} className="zone-card-item">
                      <div className="zone-card-item-main">
                        <span className="zone-item-rank">#{index + 1}</span>
                        <span className="zone-item-name">{formatLandlordName(debtor)}</span>
                        <span className="zone-item-amount zone-item-debt">
                          {formatCurrency(debtor.outstanding)}
                        </span>
                      </div>
                      <div className="zone-card-item-detail">
                        <span className="zone-item-status">Outstanding Balance</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button className="fab" onClick={() => setShowFeedback(true)} title="Send feedback or suggestion">
        <MessageSquare size={22} />
      </button>

      <Modal isOpen={showLookup} onClose={closeLookup} title="Check Your Debt" size="small">
        <form className="landlord-lookup-form" onSubmit={handleLookupSubmit}>
          {!lookupResult ? (
            <>
              <p className="lookup-instruction">
                Enter your phone number to check your outstanding balance.
              </p>
              <div className="form-group">
                <label htmlFor="lookup-phone">Phone Number</label>
                <input
                  id="lookup-phone"
                  name="phone"
                  type="tel"
                  value={lookupForm.phone}
                  onChange={handleLookupInputChange}
                  placeholder="e.g. 08012345678"
                  required
                />
              </div>
              {lookupError && <div className="lookup-error">{lookupError}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={lookupLoading}>
                {lookupLoading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
                {lookupLoading ? 'Looking up...' : 'Look Up'}
              </button>
            </>
          ) : (
            <div className="lookup-result">
              <div className="lookup-result-icon">
                <Home size={32} />
              </div>
              <h3>{lookupResult.name}</h3>
              <div className="lookup-debt-info">
                <span className="lookup-debt-label">Total Outstanding</span>
                <span className={`lookup-debt-amount ${lookupResult.outstanding > 0 ? 'has-debt' : 'clear'}`}>
                  {formatCurrency(lookupResult.outstanding)}
                </span>
              </div>
              {lookupResult.outstanding > 0 ? (
                <p className="lookup-debt-note">Please contact the Financial Secretary to settle your outstanding balance.</p>
              ) : (
                <p className="lookup-debt-note clear">Your account is fully paid up. Thank you!</p>
              )}
              <button className="btn btn-secondary btn-block" onClick={closeLookup}>Close</button>
            </div>
          )}
        </form>
      </Modal>

      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
};

export default PublicZonePage;