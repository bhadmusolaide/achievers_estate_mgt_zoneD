import { useState, useEffect, useCallback } from 'react';
import { Users, AlertTriangle, Plus, X, CheckCircle, Loader2 } from 'lucide-react';
import Modal from '../common/Modal';
import { financialOverviewService } from '../../services/financialOverviewService';
import { formatCurrency, getMonthName } from '../../utils/helpers';

const emptyAssignment = () => ({
  id: crypto.randomUUID(),
  paymentTypeId: '',
  amount: '',
  frequency: 'monthly',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
});

const BulkAssignmentModal = ({
  isOpen,
  onClose,
  selectedLandlords,
  onSuccess,
  adminId,
  mode = 'assign',
}) => {
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [assignments, setAssignments] = useState([emptyAssignment()]);
  const [selectedPaymentType, setSelectedPaymentType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadPaymentTypes();
      setAssignments([emptyAssignment()]);
      setSelectedPaymentType('');
      setError('');
      setShowConfirm(false);
      setResults(null);
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

  const getAvailableTypesForRow = (rowId) => {
    const usedTypeIds = assignments
      .filter(a => a.id !== rowId && a.paymentTypeId)
      .map(a => a.paymentTypeId);
    return paymentTypes.filter(t => !usedTypeIds.includes(t.id));
  };

  const updateAssignment = (id, field, value) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };

      if (field === 'paymentTypeId') {
        const type = paymentTypes.find(t => t.id === value);
        if (type?.default_amount) updated.amount = type.default_amount.toString();
        if (type?.frequency) updated.frequency = type.frequency;
        if (type.frequency === 'yearly' || type.frequency === 'one-time') {
          updated.month = 1;
        }
      }

      if (field === 'frequency') {
        if (value === 'yearly' || value === 'one-time') {
          updated.month = 1;
        } else {
          updated.month = new Date().getMonth() + 1;
        }
      }

      return updated;
    }));
  };

  const addAssignment = () => {
    setAssignments(prev => [...prev, emptyAssignment()]);
  };

  const removeAssignment = (id) => {
    if (assignments.length <= 1) return;
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const hasDuplicateTypes = assignments.some((a, i) =>
    a.paymentTypeId && assignments.slice(i + 1).some(b => b.paymentTypeId === a.paymentTypeId)
  );

  const validate = useCallback(() => {
    if (assignments.length === 0) {
      setError('Add at least one payment type');
      return false;
    }

    for (const a of assignments) {
      if (!a.paymentTypeId) {
        setError('All rows must have a payment type selected');
        return false;
      }
      if (mode === 'assign' && (!a.amount || parseFloat(a.amount) <= 0)) {
        const type = paymentTypes.find(t => t.id === a.paymentTypeId);
        setError(`"${type?.name || 'Unknown'}" requires a valid amount`);
        return false;
      }
    }

    if (hasDuplicateTypes) {
      setError('Each payment type can only be assigned once per batch');
      return false;
    }

    return true;
  }, [assignments, mode, paymentTypes, hasDuplicateTypes]);

  const handleSubmit = () => {
    setError('');
    if (!validate()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    const landlordIds = selectedLandlords.map(l => l.id);
    const completed = [];
    const failed = [];

    for (const a of assignments) {
      try {
        if (mode === 'assign') {
          await financialOverviewService.bulkAssign(
            landlordIds,
            a.paymentTypeId,
            parseFloat(a.amount),
            adminId,
            a.frequency,
            (a.frequency === 'monthly' || a.frequency === 'one-time') ? a.month : null,
            a.year
          );
        } else {
          await financialOverviewService.bulkUnassign(
            landlordIds,
            a.paymentTypeId,
            adminId,
            a.year
          );
        }
        completed.push(a);
      } catch (err) {
        failed.push({ assignment: a, error: err.message || 'Operation failed' });
      }
    }

    if (failed.length === 0) {
      onSuccess?.();
      onClose();
    } else {
      setResults({ completed, failed });
      setShowConfirm(false);
    }

    setLoading(false);
  };

  const selectedTypeName = paymentTypes.find(t => t.id === selectedPaymentType)?.name || '';

  const renderAssignmentRow = (assignment, index) => {
    const availableTypes = getAvailableTypesForRow(assignment.id);
    const selectedType = paymentTypes.find(t => t.id === assignment.paymentTypeId);
    const showMonth = assignment.frequency === 'monthly' || assignment.frequency === 'one-time';
    const showYear = assignment.frequency === 'yearly' || assignment.frequency === 'one-time';

    return (
      <div key={assignment.id} className="assignment-row">
        <div className="assignment-row-header">
          <span className="assignment-row-label">Type #{index + 1}</span>
          {assignments.length > 1 && (
            <button
              type="button"
              className="btn-icon btn-icon-sm btn-icon-danger"
              onClick={() => removeAssignment(assignment.id)}
              title="Remove this type"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="assignment-row-fields">
          <div className="form-group">
            <label>Payment Type</label>
            <select
              value={assignment.paymentTypeId}
              onChange={(e) => updateAssignment(assignment.id, 'paymentTypeId', e.target.value)}
            >
              <option value="">Select type...</option>
              {availableTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.frequency ? `(${type.frequency})` : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'assign' && (
            <div className="form-group">
              <label>Amount</label>
              <div className="input-with-icon">
                <span className="currency-symbol">₦</span>
                <input
                  type="number"
                  value={assignment.amount}
                  onChange={(e) => updateAssignment(assignment.id, 'amount', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          {mode === 'assign' && (
            <div className="form-group">
              <label>Frequency</label>
              <select
                value={assignment.frequency}
                onChange={(e) => updateAssignment(assignment.id, 'frequency', e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
          )}

          {showMonth && (
            <div className="form-group">
              <label>Month</label>
              <select
                value={assignment.month}
                onChange={(e) => updateAssignment(assignment.id, 'month', parseInt(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                ))}
              </select>
            </div>
          )}

          {showYear && (
            <div className="form-group">
              <label>Year</label>
              <select
                value={assignment.year}
                onChange={(e) => updateAssignment(assignment.id, 'year', parseInt(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'assign' ? 'Assign Payment Types' : 'Unassign Payment Type'}
      size="medium"
    >
      <div className="bulk-assignment-modal">
        {results ? (
          <div className="assignment-results">
            <div className="results-icon results-icon-success">
              <CheckCircle size={48} />
            </div>
            <h3>Completed with {results.failed.length} error(s)</h3>
            <p className="results-summary">
              {results.completed.length} type(s) assigned successfully
              {results.failed.length > 0 && `, ${results.failed.length} failed`}
            </p>
            {results.failed.length > 0 && (
              <ul className="results-errors">
                {results.failed.map((f, i) => {
                  const type = paymentTypes.find(t => t.id === f.assignment.paymentTypeId);
                  return (
                    <li key={i}>
                      <strong>{type?.name || 'Unknown'}</strong>: {f.error}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : !showConfirm ? (
          <>
            <div className="selection-summary">
              <Users size={20} />
              <span>{selectedLandlords.length} landlord(s) selected</span>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="assignments-list">
              {assignments.map((a, i) => renderAssignmentRow(a, i))}
            </div>

            {mode === 'assign' && (
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={addAssignment}
              >
                <Plus size={16} /> Add Another Type
              </button>
            )}

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className={`btn ${mode === 'assign' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleSubmit}
              >
                {mode === 'assign'
                  ? `Assign (${assignments.length} type${assignments.length > 1 ? 's' : ''})`
                  : 'Unassign'}
              </button>
            </div>
          </>
        ) : (
          <div className="confirm-action-modal">
            <div className="confirm-icon" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={48} />
            </div>

            <div className="confirm-header">
              <h3>Confirm {mode === 'assign' ? 'Assignments' : 'Unassignment'}</h3>
            </div>

            <p className="confirm-summary">
              {mode === 'assign'
                ? `You are about to assign ${assignments.length} type(s) to ${selectedLandlords.length} landlord(s):`
                : `You are about to unassign "${selectedTypeName}" from ${selectedLandlords.length} landlord(s).`}
            </p>

            {mode === 'assign' && (
              <ul className="confirm-assignment-list">
                {assignments.map(a => {
                  const type = paymentTypes.find(t => t.id === a.paymentTypeId);
                  return (
                    <li key={a.id}>
                      <strong>{type?.name || 'Unknown'}</strong>
                      {' — '}{formatCurrency(parseFloat(a.amount))}
                      {' — '}{a.frequency}
                      {a.frequency !== 'yearly' && ` — ${getMonthName(a.month)}`}
                      {' — '}{a.year}
                    </li>
                  );
                })}
              </ul>
            )}

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
                {loading ? <><Loader2 className="spin" size={18} /> Processing...</> : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkAssignmentModal;