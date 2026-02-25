import { User, Phone, Mail, Home, Calendar, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate, getStatusClass, formatLandlordName } from '../../utils/helpers';

const LandlordProfile = ({ landlord, paymentSummary }) => {
  if (!landlord) return null;

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

        <div className="detail-item">
          <Home size={18} />
          <div>
            <label>Address</label>
            <span>{landlord.house_address}</span>
          </div>
        </div>

        {landlord.road && (
          <div className="detail-item">
            <Home size={18} />
            <div>
              <label>Road</label>
              <span>{landlord.road}</span>
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
                <span className="summary-value">{paymentSummary.paymentCount}</span>
                <span className="summary-label">Payments Made</span>
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

      {landlord.payments && landlord.payments.length > 0 && (
        <div className="profile-payments">
          <h3>Payment History</h3>
          <div className="payment-list">
            {landlord.payments.map((payment) => (
              <div key={payment.id} className="payment-item">
                <div className="payment-info">
                  <span className="payment-type">
                    {payment.payment_types?.name || 'Payment'}
                  </span>
                  <span className="payment-date">{formatDate(payment.created_at)}</span>
                </div>
                <div className="payment-amount">
                  <span className={`badge ${getStatusClass(payment.status)}`}>
                    {payment.status}
                  </span>
                  <span>{formatCurrency(payment.amount)}</span>
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

