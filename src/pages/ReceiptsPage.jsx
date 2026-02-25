import { useState, useEffect } from 'react';
import { Eye, Mail, MessageCircle, Check } from 'lucide-react';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import SearchFilter from '../components/common/SearchFilter';
import Modal from '../components/common/Modal';
import ReceiptActions from '../components/receipts/ReceiptActions';
import { receiptService } from '../services/receiptService';
import { formatCurrency, formatDateTime, formatLandlordName } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const ReceiptsPage = () => {
  const { adminProfile } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadReceipts = async () => {
    try {
      const data = await receiptService.getAll(filters);
      setReceipts(data);
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleView = async (receipt) => {
    const full = await receiptService.getById(receipt.id);
    setSelectedReceipt(full);
    setShowModal(true);
  };

  const columns = [
    { 
      key: 'receipt_number', 
      header: 'Receipt #',
      render: (row) => <span className="mono">{row.receipt_number}</span>
    },
    { 
      key: 'landlord', 
      header: 'Landlord',
      render: (row) => formatLandlordName(row.payments?.landlords)
    },
    { 
      key: 'type', 
      header: 'Payment Type',
      render: (row) => <span className="capitalize">{row.payments?.payment_types?.name}</span>
    },
    { 
      key: 'amount', 
      header: 'Amount',
      render: (row) => formatCurrency(row.payments?.amount || 0)
    },
    { 
      key: 'email_status', 
      header: 'Email',
      render: (row) => (
        <span className={`badge ${row.sent_email ? 'badge-success' : 'badge-warning'}`}>
          {row.sent_email ? <Check size={12} /> : <Mail size={12} />}
          {row.sent_email ? ' Sent' : ' Pending'}
        </span>
      )
    },
    { 
      key: 'whatsapp_status', 
      header: 'WhatsApp',
      render: (row) => (
        <span className={`badge ${row.sent_whatsapp ? 'badge-success' : 'badge-warning'}`}>
          {row.sent_whatsapp ? <Check size={12} /> : <MessageCircle size={12} />}
          {row.sent_whatsapp ? ' Sent' : ' Pending'}
        </span>
      )
    },
    { 
      key: 'generated_at', 
      header: 'Generated',
      render: (row) => formatDateTime(row.generated_at)
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button 
            className="btn-icon" 
            onClick={(e) => { e.stopPropagation(); handleView(row); }}
            title="View & Send"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ];

  const filterOptions = [
    {
      key: 'sent_email',
      label: 'Email Status',
      options: [
        { value: 'true', label: 'Sent' },
        { value: 'false', label: 'Not Sent' },
      ]
    },
    {
      key: 'sent_whatsapp',
      label: 'WhatsApp Status',
      options: [
        { value: 'true', label: 'Sent' },
        { value: 'false', label: 'Not Sent' },
      ]
    }
  ];

  return (
    <div className="page receipts-page">
      <Header title="Receipts" />
      <div className="page-content">
        <div className="page-header">
          <SearchFilter filters={filterOptions} onFilterChange={handleFilterChange} activeFilters={filters} />
        </div>
        <DataTable columns={columns} data={receipts} loading={loading} emptyMessage="No receipts found" />
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Receipt Details" size="medium">
        {selectedReceipt && (
          <div className="receipt-view">
            <div className="receipt-info">
              <div className="info-row">
                <span>Receipt Number:</span>
                <span className="mono">{selectedReceipt.receipt_number}</span>
              </div>
              <div className="info-row">
                <span>Landlord:</span>
                <span>{formatLandlordName(selectedReceipt.payments?.landlords)}</span>
              </div>
              <div className="info-row">
                <span>Address:</span>
                <span>{selectedReceipt.payments?.landlords?.house_address}</span>
              </div>
              <div className="info-row">
                <span>Amount:</span>
                <span>{formatCurrency(selectedReceipt.payments?.amount)}</span>
              </div>
            </div>
            <ReceiptActions 
              receipt={selectedReceipt} 
              payment={selectedReceipt.payments}
              landlord={selectedReceipt.payments?.landlords}
              admin={adminProfile}
              onUpdate={() => { loadReceipts(); handleView(selectedReceipt); }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReceiptsPage;

