import { useState, useEffect } from 'react';
import { Loader2, Save, X, AlertCircle } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { landlordService } from '../../services/landlordService';
import { getMonthName } from '../../utils/helpers';

const PaymentForm = ({ onSubmit, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    landlord_id: '',
    payment_type_id: '',
    amount: '',
    payment_method: 'bank_transfer',
    payment_month: new Date().getMonth() + 1,
    payment_year: new Date().getFullYear(),
    obligation_description: '',
  });
  const [errors, setErrors] = useState({});
  const [landlords, setLandlords] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [duplicateError, setDuplicateError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const [landlordsData, typesData] = await Promise.all([
        landlordService.getAll({ status: 'active' }),
        paymentService.getPaymentTypes(),
      ]);
      setLandlords(landlordsData);
      setPaymentTypes(typesData);
    } catch (error) {
      console.error('Error loading form data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const checkDuplicate = async () => {
    if (formData.landlord_id && formData.payment_type_id) {
      // If obligation_description is provided, multiple payments of same type are allowed
      if (formData.obligation_description.trim()) {
        setDuplicateError('');
        return false;
      }
      
      const isDuplicate = await paymentService.checkDuplicate(
        formData.landlord_id,
        formData.payment_type_id,
        formData.payment_month,
        formData.payment_year
      );
      if (isDuplicate) {
        setDuplicateError('A payment for this landlord, type, and period already exists');
        return true;
      }
    }
    setDuplicateError('');
    return false;
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.landlord_id) newErrors.landlord_id = 'Select a landlord';
    if (!formData.payment_type_id) newErrors.payment_type_id = 'Select payment type';
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    setDuplicateError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const hasDuplicate = await checkDuplicate();
    if (hasDuplicate) return;
    onSubmit(formData);
  };

  if (loadingData) {
    return <div className="form-loading"><Loader2 className="spin" size={24} /></div>;
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i + 1),
  }));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <form onSubmit={handleSubmit} className="form">
      {duplicateError && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{duplicateError}</span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="landlord_id">Landlord *</label>
        <select
          id="landlord_id"
          name="landlord_id"
          value={formData.landlord_id}
          onChange={handleChange}
          className={errors.landlord_id ? 'error' : ''}
          disabled={loading}
        >
          <option value="">Select Landlord</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.full_name} - {l.house_address}{l.road ? ` (${l.road})` : ''}
            </option>
          ))}
        </select>
        {errors.landlord_id && <span className="error-text">{errors.landlord_id}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="payment_type_id">Payment Type *</label>
          <select
            id="payment_type_id"
            name="payment_type_id"
            value={formData.payment_type_id}
            onChange={handleChange}
            className={errors.payment_type_id ? 'error' : ''}
            disabled={loading}
          >
            <option value="">Select Type</option>
            {paymentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {errors.payment_type_id && <span className="error-text">{errors.payment_type_id}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="amount">Amount (₦) *</label>
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
          {errors.amount && <span className="error-text">{errors.amount}</span>}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="payment_month">Month *</label>
          <select
            id="payment_month"
            name="payment_month"
            value={formData.payment_month}
            onChange={handleChange}
            disabled={loading}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="payment_year">Year *</label>
          <select
            id="payment_year"
            name="payment_year"
            value={formData.payment_year}
            onChange={handleChange}
            disabled={loading}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="payment_method">Payment Method</label>
        <select
          id="payment_method"
          name="payment_method"
          value={formData.payment_method}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="obligation_description">Obligation Description</label>
        <input
          type="text"
          id="obligation_description"
          name="obligation_description"
          value={formData.obligation_description}
          onChange={handleChange}
          placeholder="Optional: Describe this specific payment obligation"
          disabled={loading}
        />
      </div>


      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          <X size={18} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          Log Payment
        </button>
      </div>
    </form>
  );
};

export default PaymentForm;

