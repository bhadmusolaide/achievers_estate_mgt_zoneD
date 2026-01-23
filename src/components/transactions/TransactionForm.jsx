import { useState, useEffect } from 'react';
import { Loader2, Save, X, AlertCircle, Info } from 'lucide-react';
import { transactionService } from '../../services/transactionService';
import { landlordService } from '../../services/landlordService';
import { paymentService } from '../../services/paymentService';
import { formatCurrency } from '../../utils/helpers';

const TransactionForm = ({ onSubmit, onCancel, loading, initialData = null }) => {
  const [formData, setFormData] = useState({
    transaction_type: 'credit',
    category_id: '',
    amount: '',
    description: '',
    reference: '',
    landlord_id: '',
    payment_id: '',
  });
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [approvalThreshold, setApprovalThreshold] = useState(50000);
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        transaction_type: initialData.transaction_type || 'credit',
        category_id: initialData.category_id || '',
        amount: initialData.amount || '',
        description: initialData.description || '',
        reference: initialData.reference || '',
        landlord_id: initialData.landlord_id || '',
        payment_id: initialData.payment_id || '',
      });
    }
  }, [initialData]);

  useEffect(() => {
    // Update categories when transaction type changes
    loadCategories();
  }, [formData.transaction_type]);

  useEffect(() => {
    // Check if approval is required
    const amount = parseFloat(formData.amount) || 0;
    if (formData.transaction_type === 'debit' && amount >= approvalThreshold) {
      setRequiresApproval(true);
    } else {
      setRequiresApproval(false);
    }
  }, [formData.transaction_type, formData.amount, approvalThreshold]);

  useEffect(() => {
    // Load payments when landlord is selected
    if (formData.landlord_id) {
      loadPayments(formData.landlord_id);
    } else {
      setPayments([]);
    }
  }, [formData.landlord_id]);

  const loadFormData = async () => {
    try {
      const [categoriesData, landlordsData, threshold] = await Promise.all([
        transactionService.getCategories(),
        landlordService.getAll({ status: 'active' }),
        transactionService.getApprovalThreshold(),
      ]);
      setCategories(categoriesData);
      setLandlords(landlordsData);
      setApprovalThreshold(threshold);
    } catch (error) {
      console.error('Error loading form data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await transactionService.getCategories(formData.transaction_type);
      setCategories(categoriesData);
      // Reset category if it doesn't match the new type
      if (formData.category_id) {
        const currentCategory = categoriesData.find(c => c.id === formData.category_id);
        if (!currentCategory) {
          setFormData(prev => ({ ...prev, category_id: '' }));
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPayments = async (landlordId) => {
    try {
      const paymentsData = await paymentService.getAll({ landlord_id: landlordId });
      setPayments(paymentsData.filter(p => p.status === 'confirmed'));
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.category_id) newErrors.category_id = 'Select a category';
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const transactionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      landlord_id: formData.landlord_id || null,
      payment_id: formData.payment_id || null,
    };

    onSubmit(transactionData);
  };

  if (loadingData) {
    return <div className="form-loading"><Loader2 className="spin" size={24} /></div>;
  }

  const creditCategories = categories.filter(c => c.type === 'credit');
  const debitCategories = categories.filter(c => c.type === 'debit');
  const availableCategories = formData.transaction_type === 'credit' ? creditCategories : debitCategories;

  return (
    <form onSubmit={handleSubmit} className="form">
      {requiresApproval && (
        <div className="alert alert-warning">
          <Info size={18} />
          <span>
            This transaction requires approval (amount ≥ {formatCurrency(approvalThreshold)}). 
            It will be pending until approved by Chairman or Treasurer.
          </span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="transaction_type">Transaction Type *</label>
        <select
          id="transaction_type"
          name="transaction_type"
          value={formData.transaction_type}
          onChange={handleChange}
          disabled={loading || !!initialData}
          className={errors.transaction_type ? 'error' : ''}
        >
          <option value="credit">Credit (Income)</option>
          <option value="debit">Debit (Expense)</option>
        </select>
        {errors.transaction_type && <span className="error-text">{errors.transaction_type}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="category_id">Category *</label>
        <select
          id="category_id"
          name="category_id"
          value={formData.category_id}
          onChange={handleChange}
          disabled={loading}
          className={errors.category_id ? 'error' : ''}
        >
          <option value="">Select Category</option>
          {availableCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.description || cat.name}
            </option>
          ))}
        </select>
        {errors.category_id && <span className="error-text">{errors.category_id}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount (₦) *</label>
        <div className="input-with-icon">
          <span className="currency-symbol">₦</span>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className={errors.amount ? 'error' : ''}
            disabled={loading}
          />
        </div>
        {errors.amount && <span className="error-text">{errors.amount}</span>}
        {formData.transaction_type === 'debit' && formData.amount && (
          <small className="help-text">
            Approval threshold: {formatCurrency(approvalThreshold)}
          </small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Enter transaction description..."
          rows="3"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reference">Reference Number</label>
        <input
          type="text"
          id="reference"
          name="reference"
          value={formData.reference}
          onChange={handleChange}
          placeholder="Optional reference number"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="landlord_id">Link to Landlord (Optional)</label>
        <select
          id="landlord_id"
          name="landlord_id"
          value={formData.landlord_id}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="">None</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.full_name} - {l.house_address}
            </option>
          ))}
        </select>
      </div>

      {formData.landlord_id && (
        <div className="form-group">
          <label htmlFor="payment_id">Link to Payment (Optional)</label>
          <select
            id="payment_id"
            name="payment_id"
            value={formData.payment_id}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="">None</option>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference_code} - {formatCurrency(p.amount)} ({p.payment_types?.name})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          <X size={18} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          {initialData ? 'Update Transaction' : 'Create Transaction'}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
