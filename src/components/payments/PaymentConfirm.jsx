import { useState } from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/helpers';

const PaymentConfirm = ({ payment, onConfirm, onCancel, loading }) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!payment) return null;

  const handleConfirm = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    onConfirm(payment.id);
  };

  return (
    <div className="confirm-dialog">
      <div className="confirm-icon warning">
        <AlertTriangle size={48} />
      </div>

      <h3>Confirm Bank Payment</h3>
      <p className="confirm-message">
        Please verify that the bank payment has been received before confirming.
        This action cannot be undone.
      </p>

      <div className="payment-details">
        <div className="detail-row">
          <span>Landlord:</span>
          <span>{payment.landlords?.full_name}</span>
        </div>
        <div className="detail-row">
          <span>Address:</span>
          <span>{payment.landlords?.house_address}</span>
        </div>
        <div className="detail-row">
          <span>Payment Type:</span>
          <span className="capitalize">{payment.payment_types?.name}</span>
        </div>
        <div className="detail-row">
          <span>Amount:</span>
          <span className="amount">{formatCurrency(payment.amount)}</span>
        </div>
        <div className="detail-row">
          <span>Method:</span>
          <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
        </div>
        <div className="detail-row">
          <span>Reference:</span>
          <span className="mono">{payment.reference_code}</span>
        </div>
        <div className="detail-row">
          <span>Logged:</span>
          <span>{formatDateTime(payment.created_at)}</span>
        </div>
      </div>

      {confirmed && (
        <div className="confirm-checkbox">
          <label>
            <input type="checkbox" checked readOnly />
            I confirm the bank payment has been verified
          </label>
        </div>
      )}

      <div className="confirm-actions">
        <button 
          className="btn btn-secondary" 
          onClick={onCancel}
          disabled={loading}
        >
          <X size={18} /> Cancel
        </button>
        <button 
          className={`btn ${confirmed ? 'btn-success' : 'btn-primary'}`}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="spin" size={18} />
          ) : (
            <Check size={18} />
          )}
          {confirmed ? 'Confirm Payment' : 'Proceed to Confirm'}
        </button>
      </div>
    </div>
  );
};

export default PaymentConfirm;

