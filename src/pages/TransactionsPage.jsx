import { useState, useEffect } from 'react';
import { Plus, Download, FileText, DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle, XCircle, Eye } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import StatsCard from '../components/common/StatsCard';
import Modal from '../components/common/Modal';
import SearchFilter from '../components/common/SearchFilter';
import TransactionForm from '../components/transactions/TransactionForm';
import ConfirmActionModal from '../components/common/ConfirmActionModal';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusClass, formatLandlordName } from '../utils/helpers';

const TransactionsPage = () => {
  const { adminProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [statistics, setStatistics] = useState({
    currentBalance: 0,
    totalCredits: 0,
    totalDebits: 0,
    netFlow: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transactionToApprove, setTransactionToApprove] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [exportData, setExportData] = useState([]);
  const [loadingExport, setLoadingExport] = useState(false);
  const [approvalRoles, setApprovalRoles] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const loadInitialData = async () => {
    try {
      const [categoriesData, rolesData] = await Promise.all([
        transactionService.getCategories(),
        transactionService.getApprovalRoles(),
      ]);
      setCategories(categoriesData);
      setApprovalRoles(rolesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionsResult, statsResult] = await Promise.all([
        transactionService.getAll({ ...filters, page, pageSize: 20 }),
        transactionService.getStatistics(filters),
      ]);
      
      setTransactions(transactionsResult.data);
      setTotalPages(Math.ceil(transactionsResult.count / 20));
      setTotalCount(transactionsResult.count);
      setStatistics(statsResult);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleSearch = (search) => {
    setFilters(prev => ({ ...prev, search: search || undefined }));
    setPage(1);
  };

  const handleAdd = () => {
    setSelectedTransaction(null);
    setModalMode('add');
    setShowModal(true);
  };

  const handleView = async (transaction) => {
    const full = await transactionService.getById(transaction.id);
    setSelectedTransaction(full);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      await transactionService.create(formData, adminProfile.id);
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApproveClick = (transaction) => {
    setTransactionToApprove(transaction);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!transactionToApprove) return;
    setSaving(true);
    try {
      await transactionService.approve(transactionToApprove.id, adminProfile.id);
      setShowApproveModal(false);
      setTransactionToApprove(null);
      loadData();
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert('Failed to approve transaction: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRejectClick = (transaction) => {
    setTransactionToApprove(transaction);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!transactionToApprove) return;
    setSaving(true);
    try {
      await transactionService.reject(transactionToApprove.id, adminProfile.id, rejectionReason);
      setShowRejectModal(false);
      setTransactionToApprove(null);
      setRejectionReason('');
      loadData();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      alert('Failed to reject transaction: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const prepareExportData = async () => {
    setLoadingExport(true);
    try {
      const { data } = await transactionService.getExportData(filters);
      setExportData(data);
    } catch (error) {
      console.error('Error preparing export data:', error);
    } finally {
      setLoadingExport(false);
    }
  };

  const handleExportCSV = async () => {
    await prepareExportData();
    if (exportData.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Reference', 'Status', 'Landlord', 'Created By'];
    const rows = exportData.map(t => [
      formatDateTime(t.created_at),
      t.transaction_type,
      t.transaction_categories?.name || '',
      t.amount,
      t.description || '',
      t.reference || '',
      t.status,
      formatLandlordName(t.landlords) || '',
      t.admin_profiles?.full_name || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', class: 'badge-warning', icon: AlertCircle },
      approved: { label: 'Approved', class: 'badge-success', icon: CheckCircle },
      rejected: { label: 'Rejected', class: 'badge-danger', icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`badge ${badge.class}`}>
        <Icon size={12} /> {badge.label}
      </span>
    );
  };

  const canApproveReject = approvalRoles.includes(adminProfile?.role);

  const columns = [
    {
      key: 'created_at',
      header: 'Date',
      width: '150px',
      sortable: true,
      render: (row) => formatDateTime(row.created_at)
    },
    {
      key: 'transaction_type',
      header: 'Type',
      width: '100px',
      render: (row) => (
        <span className={`transaction-type ${row.transaction_type}`}>
          {row.transaction_type === 'credit' ? (
            <><TrendingUp size={14} /> Credit</>
          ) : (
            <><TrendingDown size={14} /> Debit</>
          )}
        </span>
      )
    },
    {
      key: 'category',
      header: 'Category',
      width: '150px',
      render: (row) => (
        <span className="category-chip">
          {row.transaction_categories?.name || 'Unknown'}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      width: '120px',
      sortable: true,
      render: (row) => (
        <span className={`amount ${row.transaction_type}`}>
          {row.transaction_type === 'credit' ? '+' : '-'}
          {formatCurrency(row.amount)}
        </span>
      )
    },
    {
      key: 'description',
      header: 'Description',
      width: '200px',
      render: (row) => (
        <span className="description-text" title={row.description}>
          {row.description || '-'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row) => getStatusBadge(row.status)
    },
    {
      key: 'landlord',
      header: 'Landlord',
      width: '150px',
      render: (row) => formatLandlordName(row.landlords) || '-'
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '150px',
      render: (row) => (
        <div className="table-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleView(row); }} title="View">
            <Eye size={16} />
          </button>
          {row.status === 'pending' && canApproveReject && (
            <>
              <button
                className="btn-icon btn-success"
                onClick={(e) => { e.stopPropagation(); handleApproveClick(row); }}
                title="Approve"
              >
                <CheckCircle size={16} />
              </button>
              <button
                className="btn-icon btn-danger"
                onClick={(e) => { e.stopPropagation(); handleRejectClick(row); }}
                title="Reject"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const filterOptions = [
    {
      key: 'transaction_type',
      label: 'Type',
      options: [
        { value: 'credit', label: 'Credit' },
        { value: 'debit', label: 'Debit' },
      ]
    },
    {
      key: 'category_id',
      label: 'Category',
      options: categories.map(c => ({ value: c.id, label: c.description || c.name }))
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
      ]
    }
  ];

  const pagination = {
    page,
    totalPages,
    from: (page - 1) * 20 + 1,
    to: Math.min(page * 20, totalCount),
    total: totalCount,
    onPageChange: setPage
  };

  return (
    <div className="page transactions-page">
      <Header title="Transactions" />
      <div className="page-content">
        {/* Summary Stats */}
        <div className="metrics-grid">
          <StatsCard
            title="Current Balance"
            value={formatCurrency(statistics.currentBalance)}
            icon={DollarSign}
            variant={statistics.currentBalance >= 0 ? 'success' : 'danger'}
          />
          <StatsCard
            title="Total Credits"
            value={formatCurrency(statistics.totalCredits)}
            icon={TrendingUp}
            variant="success"
          />
          <StatsCard
            title="Total Debits"
            value={formatCurrency(statistics.totalDebits)}
            icon={TrendingDown}
            variant="warning"
          />
          <StatsCard
            title="Net Flow"
            value={formatCurrency(statistics.netFlow)}
            icon={statistics.netFlow >= 0 ? TrendingUp : TrendingDown}
            variant={statistics.netFlow >= 0 ? 'success' : 'danger'}
          />
        </div>

        {/* Status Summary */}
        <div className="status-summary">
          <span className="status-item">
            <AlertCircle size={14} className="icon-warning" /> {statistics.pendingCount} Pending
          </span>
          <span className="status-item">
            <CheckCircle size={14} className="icon-success" /> {statistics.approvedCount} Approved
          </span>
          <span className="status-item">
            <XCircle size={14} className="icon-danger" /> {statistics.rejectedCount} Rejected
          </span>
        </div>

        {/* Filters and Actions */}
        <div className="page-header">
          <SearchFilter
            searchPlaceholder="Search transactions..."
            onSearch={handleSearch}
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            activeFilters={filters}
          />
          <div className="action-buttons">
            <button
              className="btn btn-secondary"
              onClick={handleExportCSV}
              disabled={loadingExport}
            >
              <Download size={16} /> CSV
            </button>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={18} /> Add Transaction
            </button>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={transactions}
          loading={loading}
          emptyMessage="No transactions found"
          pagination={pagination}
        />
      </div>

      {/* Transaction Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Add Transaction' : 'Transaction Details'}
        size={modalMode === 'add' ? 'medium' : 'small'}
      >
        {modalMode === 'add' && (
          <TransactionForm
            onSubmit={handleSubmit}
            onCancel={() => setShowModal(false)}
            loading={saving}
          />
        )}
        {modalMode === 'view' && selectedTransaction && (
          <div className="transaction-details">
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className={`transaction-type ${selectedTransaction.transaction_type}`}>
                {selectedTransaction.transaction_type === 'credit' ? 'Credit' : 'Debit'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Category:</span>
              <span>{selectedTransaction.transaction_categories?.description || selectedTransaction.transaction_categories?.name || 'Unknown'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Amount:</span>
              <span className="amount-large">{formatCurrency(selectedTransaction.amount)}</span>
            </div>
            {selectedTransaction.description && (
              <div className="detail-row">
                <span className="detail-label">Description:</span>
                <span>{selectedTransaction.description}</span>
              </div>
            )}
            {selectedTransaction.reference && (
              <div className="detail-row">
                <span className="detail-label">Reference:</span>
                <span>{selectedTransaction.reference}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              {getStatusBadge(selectedTransaction.status)}
            </div>
            {selectedTransaction.landlords && (
              <div className="detail-row">
                <span className="detail-label">Landlord:</span>
                <span>{formatLandlordName(selectedTransaction.landlords)}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Created By:</span>
              <span>{selectedTransaction.admin_profiles?.full_name || 'Unknown'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created At:</span>
              <span>{formatDateTime(selectedTransaction.created_at)}</span>
            </div>
            {selectedTransaction.approved_by && (
              <div className="detail-row">
                <span className="detail-label">Approved By:</span>
                <span>{selectedTransaction.approver?.full_name || 'Unknown'}</span>
              </div>
            )}
            {selectedTransaction.rejected_by && (
              <div className="detail-row">
                <span className="detail-label">Rejected By:</span>
                <span>{selectedTransaction.rejector?.full_name || 'Unknown'}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setTransactionToApprove(null);
        }}
        onConfirm={handleApprove}
        title="Approve Transaction"
        message={`Are you sure you want to approve this ${transactionToApprove?.transaction_type} transaction of ${transactionToApprove ? formatCurrency(transactionToApprove.amount) : ''}?`}
        confirmText="Approve"
        loading={saving}
      />

      {/* Reject Confirmation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setTransactionToApprove(null);
          setRejectionReason('');
        }}
        title="Reject Transaction"
        size="small"
      >
        <div className="form">
          <div className="form-group">
            <label>Rejection Reason (Optional)</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows="3"
            />
          </div>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowRejectModal(false);
                setTransactionToApprove(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleReject}
              disabled={saving}
            >
              {saving ? 'Rejecting...' : 'Reject Transaction'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
