import { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import { financialOverviewService } from '../../services/financialOverviewService';
import { formatCurrency, getMonthName } from '../../utils/helpers';

const BulkAssignmentModal = ({
  isOpen,
  onClose,
  selectedLandlords,
  onSuccess,
  adminId,
  mode = 'assign', // 'assign' or 'unassign'
}) => {
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [selectedPaymentType, setSelectedPaymentType] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPaymentTypes();
      setSelectedPaymentType('');
      setAmount('');
      setFrequency('monthly');
      setSelectedMonth(new Date().getMonth() + 1);
      setSelectedYear(new Date().getFullYear());
      setError('');
      setShowConfirm(false);
    }
  }, [isOpen]);

  const loadPaymentTypes = async () => {
    try {
      const types = await financialOverviewService.getPaymentTypes();
      setPaymentTypes(types);
    } catch {
      setError('Failed to load payment types');
    }
  };

  const handlePaymentTypeChange = (typeId) => {
    setSelectedPaymentType(typeId);
    const selectedType = paymentTypes.find(t => t.id === typeId);
    if (selectedType?.default_amount) {
      setAmount(selectedType.default_amount.toString());
    }
    if (selectedType?.frequency) {
      setFrequency(selectedType.frequency);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPaymentType) {
      setError('Please select a payment type');
      return;
    }

    if (mode === 'assign' && (!amount || parseFloat(amount) <= 0)) {
      setError('Please enter a valid amount');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      const landlordIds = selectedLandlords.map(l => l.id);

      if (mode === 'assign') {
        await financialOverviewService.bulkAssign(
          landlordIds,
          selectedPaymentType,
          parseFloat(amount),
          adminId,
          frequency,
          (frequency === 'monthly' || frequency === 'one-time') ? selectedMonth : null,
          (frequency === 'yearly' || frequency === 'one-time') ? selectedYear : null
        );
      } else {
        await financialOverviewService.bulkUnassign(
          landlordIds,
          selectedPaymentType,
          adminId
        );
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedTypeName = paymentTypes.find(t => t.id === selectedPaymentType)?.name || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'assign' ? 'Assign Payment Type' : 'Unassign Payment Type'}
      size="small"
    >
      <div className="bulk-assignment-modal">
        {!showConfirm ? (
          <>
            <div className="selection-summary">
              <Users size={20} />
              <span>{selectedLandlords.length} landlord(s) selected</span>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form">
              <div className="form-group">
                <label>Payment Type</label>
                <select
                  value={selectedPaymentType}
                  onChange={(e) => handlePaymentTypeChange(e.target.value)}
                >
                  <option value="">Select payment type...</option>
                  {paymentTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} {type.frequency ? `(${type.frequency})` : ''} {type.default_amount ? `(${formatCurrency(type.default_amount)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'assign' && (
                <>
                  <div className="form-group">
                    <label>Amount per Landlord</label>
                    <div className="input-with-icon">
                      <span className="currency-symbol">₦</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="one-time">One-time</option>
                    </select>
                  </div>

                  {(frequency === 'monthly' || frequency === 'one-time') && (
                    <div className="form-group">
                      <label>Month</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {getMonthName(i + 1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(frequency === 'yearly' || frequency === 'one-time') && (
                    <div className="form-group">
                      <label>Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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
                  )}
                </>
              )}

              <div className="form-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className={`btn ${mode === 'assign' ? 'btn-primary' : 'btn-danger'}`}
                  onClick={handleSubmit}
                >
                  {mode === 'assign' ? 'Assign' : 'Unassign'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="confirm-action-modal">
            <div className="confirm-icon" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={48} />
            </div>

            <div className="confirm-header">
              <h3>Confirm {mode === 'assign' ? 'Assignment' : 'Unassignment'}</h3>
            </div>

            <p className="confirm-summary">
              {mode === 'assign'
                ? `You are about to assign "${selectedTypeName}" with amount ${formatCurrency(parseFloat(amount))} to ${selectedLandlords.length} landlord(s).`
                : `You are about to unassign "${selectedTypeName}" from ${selectedLandlords.length} landlord(s).`}
            </p>

            {error && <div className="error-message">{error}</div>}

            <div className="confirm-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Back
              </button>
              <button
                className={`btn ${mode === 'assign' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkAssignmentModal;

