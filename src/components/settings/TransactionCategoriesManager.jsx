import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Loader2, AlertCircle } from 'lucide-react';
import { transactionService } from '../../services/transactionService';
import { useAuth } from '../../context/AuthContext';

const TransactionCategoriesManager = () => {
  const { adminProfile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'credit',
    description: '',
    active: true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await transactionService.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      type: 'credit',
      description: '',
      active: true,
    });
    setEditingId(null);
    setShowForm(true);
    setErrors({});
  };

  const handleEdit = (category) => {
    setFormData({
      name: category.name,
      type: category.type,
      description: category.description || '',
      active: category.active,
    });
    setEditingId(category.id);
    setShowForm(true);
    setErrors({});
  };

  const handleDelete = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      await transactionService.deleteCategory(categoryId);
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category: ' + error.message);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }
    if (!formData.type) {
      newErrors.type = 'Transaction type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (editingId) {
        await transactionService.updateCategory(editingId, formData);
      } else {
        await transactionService.createCategory(formData);
      }
      setShowForm(false);
      setEditingId(null);
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleToggleActive = async (category) => {
    try {
      await transactionService.updateCategory(category.id, {
        ...category,
        active: !category.active,
      });
      loadCategories();
    } catch (error) {
      console.error('Error toggling category:', error);
      alert('Failed to update category: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="spin" size={24} />
        <span>Loading categories...</span>
      </div>
    );
  }

  const creditCategories = categories.filter(c => c.type === 'credit');
  const debitCategories = categories.filter(c => c.type === 'debit');

  return (
    <div className="transaction-categories-manager">
      <div className="section-header">
        <div>
          <h3>Transaction Categories</h3>
          <p className="section-description">
            Manage transaction categories for credits and debits. Categories can be activated or deactivated.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={18} /> Add Category
        </button>
      </div>

      {showForm && (
        <div className="category-form-card">
          <div className="card-header">
            <h4>{editingId ? 'Edit Category' : 'Add New Category'}</h4>
            <button className="btn-close" onClick={() => setShowForm(false)}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="name">Category Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., rent_income, maintenance"
                className={errors.name ? 'error' : ''}
                disabled={saving || !!editingId}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
              {editingId && (
                <small className="help-text">Category name cannot be changed after creation</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="type">Transaction Type *</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={errors.type ? 'error' : ''}
                disabled={saving || !!editingId}
              >
                <option value="credit">Credit (Income)</option>
                <option value="debit">Debit (Expense)</option>
              </select>
              {errors.type && <span className="error-text">{errors.type}</span>}
              {editingId && (
                <small className="help-text">Transaction type cannot be changed after creation</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Optional description for this category"
                rows="3"
                disabled={saving}
              />
            </div>

            {editingId && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  <span>Active (Category is available for use)</span>
                </label>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                <X size={18} /> Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                {editingId ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="categories-grid">
        <div className="category-section">
          <h4>Credit Categories</h4>
          {creditCategories.length > 0 ? (
            <div className="categories-list">
              {creditCategories.map(category => (
                <div key={category.id} className={`category-item ${!category.active ? 'inactive' : ''}`}>
                  <div className="category-info">
                    <div className="category-header">
                      <span className="category-name">{category.name}</span>
                      <span className={`category-status ${category.active ? 'active' : 'inactive'}`}>
                        {category.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {category.description && (
                      <p className="category-description">{category.description}</p>
                    )}
                  </div>
                  <div className="category-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleToggleActive(category)}
                      title={category.active ? 'Deactivate' : 'Activate'}
                    >
                      {category.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(category)}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {creditCategories.length > 1 && (
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(category.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No credit categories</p>
          )}
        </div>

        <div className="category-section">
          <h4>Debit Categories</h4>
          {debitCategories.length > 0 ? (
            <div className="categories-list">
              {debitCategories.map(category => (
                <div key={category.id} className={`category-item ${!category.active ? 'inactive' : ''}`}>
                  <div className="category-info">
                    <div className="category-header">
                      <span className="category-name">{category.name}</span>
                      <span className={`category-status ${category.active ? 'active' : 'inactive'}`}>
                        {category.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {category.description && (
                      <p className="category-description">{category.description}</p>
                    )}
                  </div>
                  <div className="category-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleToggleActive(category)}
                      title={category.active ? 'Deactivate' : 'Activate'}
                    >
                      {category.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleEdit(category)}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    {debitCategories.length > 1 && (
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(category.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No debit categories</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionCategoriesManager;
