import { User, Phone, Mail, Home, Calendar, CreditCard, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, getStatusClass, formatLandlordName } from '../../utils/helpers';

const ActivityIcon = ({ item }) => {
  if (item._type === 'payment') return <Receipt size={18} />;
  return item.transaction_type === 'credit' ? <TrendingUp size={18} /> : <TrendingDown size={18} />;
};

const ActivityTitle = ({ item }) => {
  if (item._type === 'payment') return item.payment_types?.name || 'Payment';
  return item.transaction_categories?.description || item.transaction_categories?.name || 'Transaction';
};

const LandlordProfile = ({ landlord, paymentSummary, transactions }) => {
  if (!landlord) return null;

  const mergedActivity = [
    ...(landlord.payments || []).map(p => ({ ...p, _type: 'payment' })),
    ...(transactions || [])
      .filter(tx => !tx.payment_id)
      .map(tx => ({ ...tx, _type: 'transaction' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="profile-view">
      <div className="profile-header">
        <div className="profile-avatar">
          {landlord.full_name?.charAt(0) || 'L'}
        </div>
        <div className="profile-info">
          <h2>{formatLandlordName(landlord)}</h2>
          <span className={`badge ${getStatusClass(landlord.status)}`}>
            {landlord.status}
          </span>
        </div>
      </div>

      <div className="profile-details">
        <div className="detail-item">
          <Phone size={18} />
          <div>
            <label>Phone</label>
            <span>{landlord.phone}</span>
          </div>
        </div>

        {landlord.email && (
          <div className="detail-item">
            <Mail size={18} />
            <div>
              <label>Email</label>
              <span>{landlord.email}</span>
            </div>
          </div>
        )}

        {landlord.house_number && (
          <div className="detail-item">
            <Home size={18} />
            <div>
              <label>House Number</label>
              <span>{landlord.house_number}</span>
            </div>
          </div>
        )}

        {landlord.lane_number && (
          <div className="detail-item">
            <Home size={18} />
            <div>
              <label>Lane Number</label>
              <span>{landlord.lane_number}</span>
            </div>
          </div>
        )}

        {landlord.road && (
          <div className="detail-item">
            <Home size={18} />
            <div>
              <label>Road</label>
              <span>{landlord.road}</span>
            </div>
          </div>
        )}

        {landlord.occupation && (
          <div className="detail-item">
            <User size={18} />
            <div>
              <label>Occupation</label>
              <span>{landlord.occupation}</span>
            </div>
          </div>
        )}

        <div className="detail-item">
          <User size={18} />
          <div>
            <label>Occupancy</label>
            <span className="capitalize">{landlord.occupancy_type}</span>
          </div>
        </div>

        <div className="detail-item">
          <Calendar size={18} />
          <div>
            <label>Registered</label>
            <span>{formatDate(landlord.created_at)}</span>
          </div>
        </div>

        {landlord.date_of_birth && (
          <div className="detail-item">
            <Calendar size={18} />
            <div>
              <label>Date of Birth</label>
              <span>{landlord.date_of_birth}</span>
            </div>
          </div>
        )}

        {landlord.wedding_anniversary && (
          <div className="detail-item">
            <Calendar size={18} />
            <div>
              <label>Wedding Anniversary</label>
              <span>{landlord.wedding_anniversary}</span>
            </div>
          </div>
        )}

        {landlord.notes && (
          <div className="detail-item notes">
            <div>
              <label>Notes</label>
              <span>{landlord.notes}</span>
            </div>
          </div>
        )}
      </div>

      {paymentSummary && (
        <div className="profile-summary">
          <h3>Payment Summary</h3>
          <div className="summary-cards">
            <div className="summary-card">
              <CreditCard size={20} />
              <div>
                <span className="summary-value">
                  {formatCurrency(paymentSummary.totalPaid)}
                </span>
                <span className="summary-label">Total Paid</span>
              </div>
            </div>
            <div className="summary-card">
              <CreditCard size={20} />
              <div>
                <span className="summary-value">{mergedActivity.length}</span>
                <span className="summary-label">Activities</span>
              </div>
            </div>
            <div className="summary-card">
              <CreditCard size={20} />
              <div>
                <span className="summary-value">
                  {formatCurrency(paymentSummary.totalDebt || 0)}
                </span>
                <span className="summary-label">Total Debt</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {mergedActivity.length > 0 && (
        <div className="profile-activity">
          <h3>Activity History</h3>
          <div className="activity-list">
            {mergedActivity.map((item) => (
              <div key={`${item._type}-${item.id}`} className={`activity-item ${item._type} ${item.transaction_type || ''}`}>
                <div className="activity-icon">
                  <ActivityIcon item={item} />
                </div>
                <div className="activity-body">
                  <div className="activity-top">
                    <span className="activity-title"><ActivityTitle item={item} /></span>
                    <span className="activity-amount">
                      {item._type === 'transaction' && (
                        <span className={`amount-sign ${item.transaction_type}`}>
                          {item.transaction_type === 'credit' ? '+ ' : '- '}
                        </span>
                      )}
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  {item._type === 'transaction' && item.description && (
                    <span className="activity-description">{item.description}</span>
                  )}
                  <div className="activity-meta">
                    <span className="activity-label">{item._type === 'payment' ? 'Payment' : 'Ledger'}</span>
                    <span className="activity-separator">·</span>
                    <span className="activity-date">{formatDateTime(item.created_at)}</span>
                    {item._type === 'transaction' && item.reference && (
                      <>
                        <span className="activity-separator">·</span>
                        <span className="activity-ref">Ref: {item.reference}</span>
                      </>
                    )}
                    <div className="activity-spacer" />
                    <span className={`badge badge-sm ${getStatusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandlordProfile;