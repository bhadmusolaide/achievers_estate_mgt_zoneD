import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Modal from '../common/Modal';
import { paymentService } from '../../services/paymentService';
import { formatCurrency, formatDateTime, getMonthName } from '../../utils/helpers';

const PartialPaymentModal = ({ isOpen, onClose, landlord, onSuccess, adminId }) => {
  const now = new Date();
  const [formData, setFormData] = useState({
    payment_type_id: '',
    amount: '',
    payment_method: 'cash',
    payment_month: now.getMonth() + 1,
    payment_year: now.getFullYear(),
  });
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedPaymentType = paymentTypes.find(t => t.id === formData.payment_type_id);
  const paymentFrequency = selectedPaymentType?.frequency || 'monthly';
  const showMonthSelector = paymentFrequency === 'monthly';

  // Load payment types and history when modal opens
  useEffect(() => {
    if (isOpen && landlord) {
      const now = new Date();
      loadPaymentTypes();
      loadPaymentHistory();
      const defaultPaymentTypeId = landlord?.assignedPaymentTypes?.[0]?.id || '';
      setFormData({
        payment_type_id: defaultPaymentTypeId,
        amount: '',
        payment_method: 'cash',
        payment_month: now.getMonth() + 1,
        payment_year: now.getFullYear(),
      });
    }
  }, [isOpen, landlord]);

  const loadPaymentHistory = async () => {
    if (!landlord?.id) return;

    setLoadingHistory(true);
    try {
      const history = await paymentService.getAll({
        landlord_id: landlord.id
      });
      // Show last 10 payments
      setPaymentHistory(history.slice(0, 10));
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadPaymentTypes = async () => {
    setLoadingTypes(true);
    try {
      const types = await paymentService.getPaymentTypes();
      setPaymentTypes(types);
    } catch (error) {
      console.error('Error loading payment types:', error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.payment_type_id || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      await paymentService.create({
        landlord_id: landlord.id,
        payment_type_id: formData.payment_type_id,
        amount,
        payment_method: formData.payment_method,
        installment: false,
        installment_stage: null,
        payment_month: formData.payment_month,
        payment_year: formData.payment_year,
      }, adminId);

      onSuccess();
    } catch (error) {
      console.error('Error creating partial payment:', error);
      alert('Failed to create payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // When payment type changes, auto-set month based on frequency
    if (field === 'payment_type_id') {
      const type = paymentTypes.find(t => t.id === value);
      if (type?.frequency === 'yearly' || type?.frequency === 'one-time') {
        setFormData(prev => ({ ...prev, payment_month: 1 }));
      } else {
        setFormData(prev => ({ ...prev, payment_month: new Date().getMonth() + 1 }));
      }
    }
  };

  if (!landlord) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Partial Payment for ${landlord.full_name}`}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Payment Type *</label>
          <select
            value={formData.payment_type_id}
            onChange={(e) => handleInputChange('payment_type_id', e.target.value)}
            required
            disabled={loadingTypes}
          >
            <option value="">Select Payment Type</option>
            {paymentTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Amount *</label>
          <div className="input-with-icon">
            <span className="currency-symbol">₦</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          {landlord.balance > 0 && (
            <small className="help-text">
              Outstanding balance: {formatCurrency(landlord.balance)}
            </small>
          )}
        </div>

        <div className="form-row">
          {showMonthSelector && (
            <div className="form-group">
              <label>Month *</label>
              <select
                value={formData.payment_month}
                onChange={(e) => handleInputChange('payment_month', parseInt(e.target.value))}
                required
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Year *</label>
            <select
              value={formData.payment_year}
              onChange={(e) => handleInputChange('payment_year', parseInt(e.target.value))}
              required
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Payment Method *</label>
          <select
            value={formData.payment_method}
            onChange={(e) => handleInputChange('payment_method', e.target.value)}
            required
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Payment'}
          </button>
        </div>
      </form>

      {/* Payment History Section */}
      <div className="payment-history-section">
        <h4>Recent Payment History</h4>
        {loadingHistory ? (
          <div className="loading-history">Loading payment history...</div>
        ) : paymentHistory.length > 0 ? (
          <div className="payment-history-list">
            {paymentHistory.map((payment) => (
              <div key={payment.id} className="payment-history-item">
                <div className="payment-history-header">
                  <span className="payment-amount">{formatCurrency(payment.amount)}</span>
                  <span className={`payment-status status-${payment.status}`}>
                    {payment.status}
                  </span>
                </div>
                <div className="payment-history-details">
                  <span className="payment-type">{payment.payment_types?.name}</span>
                  <span className="payment-date">
                    {formatDateTime(payment.created_at)}
                  </span>
                </div>
                <div className="payment-history-meta">
                  <span className="payment-method">{payment.payment_method}</span>
                  {payment.reference_code && (
                    <span className="payment-ref">Ref: {payment.reference_code}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-history">No payment history found</div>
        )}
      </div>
    </Modal>
  );
};

export default PartialPaymentModal;