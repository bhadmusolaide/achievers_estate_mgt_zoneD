import { useState, useEffect } from 'react';
import { Plus, Check, Eye } from 'lucide-react';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import SearchFilter from '../components/common/SearchFilter';
import Modal from '../components/common/Modal';
import PaymentForm from '../components/payments/PaymentForm';
import PaymentConfirm from '../components/payments/PaymentConfirm';
import { paymentService } from '../services/paymentService';
import { receiptService } from '../services/receiptService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusClass, getMonthName, formatLandlordName } from '../utils/helpers';

const PaymentsPage = () => {
  const { adminProfile } = useAuth();
  const [payments, setPayments] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadData = async () => {
    try {
      const [paymentsData, typesData] = await Promise.all([
        paymentService.getAll(filters),
        paymentService.getPaymentTypes(),
      ]);
      setPayments(paymentsData);
      setPaymentTypes(typesData);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleAdd = () => {
    setSelectedPayment(null);
    setModalMode('add');
    setShowModal(true);
  };

  const handleConfirmClick = async (payment) => {
    const full = await paymentService.getById(payment.id);
    setSelectedPayment(full);
    setModalMode('confirm');
    setShowModal(true);
  };

  const handleView = async (payment) => {
    const full = await paymentService.getById(payment.id);
    setSelectedPayment(full);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      await paymentService.create(formData, adminProfile.id);
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Failed to save payment: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (paymentId) => {
    setSaving(true);
    try {
      await paymentService.confirm(paymentId, adminProfile.id);
      // Generate receipt
      await receiptService.create(paymentId);
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { 
      key: 'landlord', 
      header: 'Landlord',
      render: (row) => formatLandlordName(row.landlords)
    },
    { 
      key: 'type', 
      header: 'Type',
      render: (row) => <span className="capitalize">{row.payment_types?.name}</span>
    },
    { 
      key: 'amount', 
      header: 'Amount',
      render: (row) => formatCurrency(row.amount)
    },
    { 
      key: 'period', 
      header: 'Period',
      render: (row) => `${getMonthName(row.payment_month)} ${row.payment_year}`
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (row) => (
        <span className={`badge ${getStatusClass(row.status)}`}>
          {row.status}
        </span>
      )
    },
    { 
      key: 'created_at', 
      header: 'Date',
      render: (row) => formatDateTime(row.created_at)
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleView(row); }} title="View">
            <Eye size={16} />
          </button>
          {row.status === 'pending' && (
            <button 
              className="btn-icon btn-success" 
              onClick={(e) => { e.stopPropagation(); handleConfirmClick(row); }}
              title="Confirm Payment"
            >
              <Check size={16} />
            </button>
          )}
        </div>
      )
    }
  ];

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
      ]
    },
    {
      key: 'payment_type_id',
      label: 'Payment Type',
      options: paymentTypes.map(t => ({ value: t.id, label: t.name }))
    }
  ];

  return (
    <div className="page payments-page">
      <Header title="Payments" />
      <div className="page-content">
        <div className="page-header">
          <SearchFilter filters={filterOptions} onFilterChange={handleFilterChange} activeFilters={filters} />
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={18} /> Log Payment
          </button>
        </div>
        <DataTable columns={columns} data={payments} loading={loading} emptyMessage="No payments found" />
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalMode === 'add' ? 'Log Payment' : modalMode === 'confirm' ? 'Confirm Payment' : 'Payment Details'} size={modalMode === 'add' ? 'medium' : 'small'}>
        {modalMode === 'add' && <PaymentForm onSubmit={handleSubmit} onCancel={() => setShowModal(false)} loading={saving} />}
        {modalMode === 'confirm' && <PaymentConfirm payment={selectedPayment} onConfirm={handleConfirm} onCancel={() => setShowModal(false)} loading={saving} />}
        {modalMode === 'view' && selectedPayment && (
          <div className="payment-details">
            <div className="detail-row">
              <span>Landlord:</span>
              <span>{formatLandlordName(selectedPayment.landlords)}</span>
            </div>
            <div className="detail-row">
              <span>Address:</span>
              <span>{selectedPayment.landlords?.house_address}</span>
            </div>
            {selectedPayment.landlords?.road && (
              <div className="detail-row">
                <span>Road:</span>
                <span>{selectedPayment.landlords?.road}</span>
              </div>
            )}
            <div className="detail-row">
              <span>Payment Type:</span>
              <span className="capitalize">{selectedPayment.payment_types?.name}</span>
            </div>
            <div className="detail-row">
              <span>Amount:</span>
              <span className="amount">{formatCurrency(selectedPayment.amount)}</span>
            </div>
            <div className="detail-row">
              <span>Method:</span>
              <span className="capitalize">{selectedPayment.payment_method.replace('_', ' ')}</span>
            </div>
            <div className="detail-row">
              <span>Reference:</span>
              <span className="mono">{selectedPayment.reference_code}</span>
            </div>
            <div className="detail-row">
              <span>Status:</span>
              <span className={`badge ${getStatusClass(selectedPayment.status)}`}>{selectedPayment.status}</span>
            </div>
            <div className="detail-row">
              <span>Logged:</span>
              <span>{formatDateTime(selectedPayment.created_at)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;

