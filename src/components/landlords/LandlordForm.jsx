import { useState, useRef } from 'react';
import { Loader2, Save, X } from 'lucide-react';

const getInitialFormData = (landlord) => ({
  full_name: landlord?.full_name || '',
  phone: landlord?.phone || '',
  email: landlord?.email || '',
  house_address: landlord?.house_address || '',
  road: landlord?.road || '',
  zone: landlord?.zone || 'Zone D',
  occupancy_type: landlord?.occupancy_type || 'owner',
  status: landlord?.status || 'active',
  date_of_birth: landlord?.date_of_birth ? `2000-${landlord.date_of_birth}` : '',
  wedding_anniversary: landlord?.wedding_anniversary ? `2000-${landlord.wedding_anniversary}` : '',
  celebrate_opt_in: landlord?.celebrate_opt_in || false,
});

const LandlordForm = ({ landlord, onSubmit, onCancel, loading }) => {
  // Track landlord id to detect changes and reinitialize form
  const landlordIdRef = useRef(landlord?.id);

  // Reinitialize form data when landlord changes
  const getFormData = () => {
    if (landlordIdRef.current !== landlord?.id) {
      landlordIdRef.current = landlord?.id;
    }
    return getInitialFormData(landlord);
  };

  const [formData, setFormData] = useState(getFormData);
  const [errors, setErrors] = useState({});

  // Check if landlord changed and reset form data
  if (landlordIdRef.current !== landlord?.id) {
    landlordIdRef.current = landlord?.id;
    setFormData(getInitialFormData(landlord));
  }

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.house_address.trim()) newErrors.house_address = 'Address is required';
    if (!formData.road.trim()) newErrors.road = 'Road is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      const submitData = { ...formData };
      // Convert dates to MM-DD format for database
      if (submitData.date_of_birth) {
        const date = new Date(submitData.date_of_birth);
        submitData.date_of_birth = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      if (submitData.wedding_anniversary) {
        const date = new Date(submitData.wedding_anniversary);
        submitData.wedding_anniversary = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      onSubmit(submitData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label htmlFor="full_name">Full Name *</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          className={errors.full_name ? 'error' : ''}
          disabled={loading}
        />
        {errors.full_name && <span className="error-text">{errors.full_name}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Phone Number *</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="08012345678"
            className={errors.phone ? 'error' : ''}
            disabled={loading}
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
            disabled={loading}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="house_address">House Address *</label>
        <input
          type="text"
          id="house_address"
          name="house_address"
          value={formData.house_address}
          onChange={handleChange}
          placeholder="e.g. House 15"
          className={errors.house_address ? 'error' : ''}
          disabled={loading}
        />
        {errors.house_address && <span className="error-text">{errors.house_address}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="road">Road *</label>
        <input
          type="text"
          id="road"
          name="road"
          value={formData.road}
          onChange={handleChange}
          placeholder="e.g., Road 1, Road 3"
          className={errors.road ? 'error' : ''}
          disabled={loading}
        />
        {errors.road && <span className="error-text">{errors.road}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="occupancy_type">Occupancy Type</label>
          <select
            id="occupancy_type"
            name="occupancy_type"
            value={formData.occupancy_type}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="form-section">
        <h4 className="form-section-title">Celebration Details (Optional)</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date_of_birth">Date of Birth</label>
            <input
              type="date"
              id="date_of_birth"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="wedding_anniversary">Wedding Anniversary</label>
            <input
              type="date"
              id="wedding_anniversary"
              name="wedding_anniversary"
              value={formData.wedding_anniversary}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
        </div>
        <div className="form-group form-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              id="celebrate_opt_in"
              name="celebrate_opt_in"
              checked={formData.celebrate_opt_in}
              onChange={handleChange}
              disabled={loading}
            />
            <span className="checkbox-text">
              Send celebration messages for birthdays and anniversaries
            </span>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          <X size={18} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          {landlord ? 'Update Landlord' : 'Add Landlord'}
        </button>
      </div>
    </form>
  );
};

export default LandlordForm;

