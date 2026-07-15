import { useState, useEffect } from 'react';
import { MessageSquare, Eye, Trash2 } from 'lucide-react';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import SearchFilter from '../components/common/SearchFilter';
import Modal from '../components/common/Modal';
import { feedbackService } from '../services/feedbackService';
import { formatDateTime } from '../utils/helpers';

const CATEGORY_LABELS = {
  suggestion: 'Suggestion',
  bug: 'Bug Report',
  compliment: 'Compliment',
  other: 'Other',
};

const FeedbackPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await feedbackService.list();
      let filtered = [...data];

      if (filters.category) {
        filtered = filtered.filter((i) => i.category === filters.category);
      }

      setItems(filtered);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleView = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const columns = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => row.name || 'Anonymous',
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || '-',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone || '-',
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className={`badge badge-${row.category === 'bug' ? 'danger' : row.category === 'compliment' ? 'success' : row.category === 'suggestion' ? 'info' : 'default'}`}>
          {CATEGORY_LABELS[row.category] || row.category}
        </span>
      ),
    },
    {
      key: 'message_preview',
      header: 'Message',
      render: (row) => (
        <span className="feedback-preview">
          {row.message.length > 80 ? row.message.slice(0, 80) + '...' : row.message}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (row) => (
        <div className="table-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleView(row); }} title="View details">
            <Eye size={16} />
          </button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    {
      key: 'category',
      label: 'Category',
      options: [
        { value: 'suggestion', label: 'Suggestion' },
        { value: 'bug', label: 'Bug Report' },
        { value: 'compliment', label: 'Compliment' },
        { value: 'other', label: 'Other' },
      ],
    },
  ];

  return (
    <div className="page feedback-page">
      <Header title="Feedback & Suggestions" subtitle="View feedback submitted by landlords from the public zone-info page" />
      <div className="page-content">
        <div className="page-header">
          <SearchFilter filters={filterOptions} onFilterChange={handleFilterChange} activeFilters={filters} />
        </div>
        <DataTable columns={columns} data={items} loading={loading} emptyMessage="No feedback received yet" />
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Feedback Details" size="small">
        {selectedItem && (
          <div className="feedback-detail">
            <div className="feedback-detail-row">
              <span className="feedback-detail-label">Name</span>
              <span>{selectedItem.name || 'Anonymous'}</span>
            </div>
            {selectedItem.email && (
              <div className="feedback-detail-row">
                <span className="feedback-detail-label">Email</span>
                <span>{selectedItem.email}</span>
              </div>
            )}
            {selectedItem.phone && (
              <div className="feedback-detail-row">
                <span className="feedback-detail-label">Phone</span>
                <span>{selectedItem.phone}</span>
              </div>
            )}
            <div className="feedback-detail-row">
              <span className="feedback-detail-label">Category</span>
              <span className={`badge badge-${selectedItem.category === 'bug' ? 'danger' : selectedItem.category === 'compliment' ? 'success' : selectedItem.category === 'suggestion' ? 'info' : 'default'}`}>
                {CATEGORY_LABELS[selectedItem.category] || selectedItem.category}
              </span>
            </div>
            <div className="feedback-detail-row">
              <span className="feedback-detail-label">Date</span>
              <span>{formatDateTime(selectedItem.created_at)}</span>
            </div>
            <div className="feedback-detail-message">
              <span className="feedback-detail-label">Message</span>
              <p>{selectedItem.message}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackPage;