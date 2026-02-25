import { useState, useEffect } from 'react';
import {
  Download, FileText, Users, CheckCircle,
  AlertCircle, Clock, DollarSign, Link as LinkIcon,
  Plus, Minus, Edit, Wallet
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import StatsCard from '../components/common/StatsCard';
import Modal from '../components/common/Modal';
import BulkAssignmentModal from '../components/financial/BulkAssignmentModal';
import PartialPaymentModal from '../components/financial/PartialPaymentModal';
import FinancialReportPDF from '../components/financial/FinancialReportPDF';
import { financialOverviewService } from '../services/financialOverviewService';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatLandlordName } from '../utils/helpers';

const FinancialOverviewPage = () => {
  const { adminProfile } = useAuth();
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({
    totalExpected: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    landlordCount: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'asc' });
  
  // Selection state
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignMode, setAssignMode] = useState('assign');
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [selectedLandlordForPartial, setSelectedLandlordForPartial] = useState(null);
  const [exportData, setExportData] = useState([]);
  const [loadingExport, setLoadingExport] = useState(false);
  const [accountBalance, setAccountBalance] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, sortConfig]);

  const loadInitialData = async () => {
    try {
      const [typesData, balanceData] = await Promise.all([
        financialOverviewService.getPaymentTypes(),
        transactionService.getAccountBalance(),
      ]);
      setPaymentTypes(typesData);
      setAccountBalance(parseFloat(balanceData.balance || 0));
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewResult, totalsResult] = await Promise.all([
        financialOverviewService.getOverview(filters, page, 20, sortConfig),
        financialOverviewService.getAggregateTotals(filters)
      ]);
      
      setData(overviewResult.data);
      setTotalPages(overviewResult.totalPages);
      setTotalCount(overviewResult.count);
      setTotals(totalsResult);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setFilters(prev => ({ ...prev, search: value || undefined }));
    setPage(1);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPage(1); // Reset to first page when sorting
  };

  const handleSelectRow = (landlord) => {
    setSelectedRows(prev => {
      const exists = prev.find(r => r.id === landlord.id);
      if (exists) {
        return prev.filter(r => r.id !== landlord.id);
      }
      return [...prev, landlord];
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
      setSelectAll(false);
    } else {
      setSelectedRows([...data]);
      setSelectAll(true);
    }
  };

  const handleAssign = () => {
    setAssignMode('assign');
    setShowAssignModal(true);
  };

  const handleUnassign = () => {
    setAssignMode('unassign');
    setShowAssignModal(true);
  };

  const handleAssignmentSuccess = () => {
    setSelectedRows([]);
    setSelectAll(false);
    loadData();
  };

  const handleMarkAsPaid = async (landlord) => {
    if (landlord.balance <= 0) return; // Already paid

    try {
      await financialOverviewService.createOutstandingPayments(landlord.id, adminProfile.id);
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid: ' + error.message);
    }
  };

  const handlePartialPayment = (landlord) => {
    setSelectedLandlordForPartial(landlord);
    setShowPartialModal(true);
  };

  const handlePartialPaymentSuccess = () => {
    setShowPartialModal(false);
    setSelectedLandlordForPartial(null);
    loadData(); // Refresh data
  };

  const handleExportCSV = async () => {
    setLoadingExport(true);
    try {
      const exportResult = await financialOverviewService.getExportData(filters);
      
      const headers = ['Landlord Name', 'Zone', 'Payment Types', 'Expected', 'Paid', 'Balance', 'Status', 'Last Payment'];
      const rows = exportResult.map(row => [
        formatLandlordName(row),
        row.zone,
        row.assignedPaymentTypes.map(t => t.name).join('; '),
        row.totalExpected,
        row.totalPaid,
        row.balance,
        row.paymentStatus,
        row.lastPaymentDate ? formatDate(row.lastPaymentDate, 'yyyy-MM-dd') : ''
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial-overview-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setLoadingExport(false);
    }
  };

  const prepareExportData = async () => {
    if (exportData.length === 0) {
      setLoadingExport(true);
      try {
        const result = await financialOverviewService.getExportData(filters);
        setExportData(result);
      } catch (error) {
        console.error('Error preparing export:', error);
      } finally {
        setLoadingExport(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      paid: { class: 'badge-success', icon: CheckCircle, label: 'Paid' },
      partial: { class: 'badge-warning', icon: AlertCircle, label: 'Partial' },
      pending: { class: 'badge-danger', icon: Clock, label: 'Pending' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`badge ${badge.class}`}>
        <badge.icon size={12} /> {badge.label}
      </span>
    );
  };

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectAll}
          onChange={handleSelectAll}
        />
      ),
      width: '40px',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.some(r => r.id === row.id)}
          onChange={() => handleSelectRow(row)}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    {
      key: 'full_name',
      header: 'Landlord',
      width: '180px',
      sortable: true,
      render: (row) => (
        <div className="landlord-cell">
          <span className="landlord-name">{formatLandlordName(row)}</span>
          <span className="landlord-address">{row.house_address}</span>
        </div>
      )
    },
    {
      key: 'assignedPaymentTypes',
      header: 'Payment Types',
      width: '200px',
      render: (row) => (
        <div className="payment-types-cell">
          {row.assignedPaymentTypes.length > 0 ? (
            row.assignedPaymentTypes.map(type => (
              <div key={type.id} className="payment-type-breakdown" title={`Expected: ${formatCurrency(type.expected)} | Paid: ${formatCurrency(type.paid)} | Balance: ${formatCurrency(type.balance)}`}>
                <span className={`payment-type-chip ${type.balance <= 0 ? 'paid' : type.paid > 0 ? 'partial' : 'pending'}`}>
                  {type.name}
                </span>
                <span className="payment-type-amounts">
                  {formatCurrency(type.paid)}/{formatCurrency(type.expected)}
                </span>
              </div>
            ))
          ) : (
            <span className="no-types">None assigned</span>
          )}
          {row.totalUnassignedPaid > 0 && (
            <div className="unassigned-payments" title="Payments for unassigned payment types">
              <span className="payment-type-chip other">Other</span>
              <span className="payment-type-amounts">{formatCurrency(row.totalUnassignedPaid)}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'totalExpected',
      header: 'Expected',
      width: '120px',
      sortable: true,
      render: (row) => formatCurrency(row.totalExpected)
    },
    {
      key: 'totalPaid',
      header: 'Paid',
      width: '120px',
      sortable: true,
      render: (row) => (
        <span className="amount-paid">{formatCurrency(row.totalPaid)}</span>
      )
    },
    {
      key: 'balance',
      header: 'Balance',
      width: '120px',
      sortable: true,
      render: (row) => (
        <span className={row.balance > 0 ? 'balance-outstanding' : 'balance-clear'}>
          {formatCurrency(row.balance)}
        </span>
      )
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      width: '100px',
      sortable: true,
      render: (row) => getStatusBadge(row.paymentStatus)
    },
    {
      key: 'lastPaymentDate',
      header: 'Last Payment',
      width: '120px',
      sortable: true,
      render: (row) => row.lastPaymentDate
        ? formatDate(row.lastPaymentDate, 'MMM dd, yyyy')
        : '-'
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (row) => (
        <div className="action-buttons" style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn-icon"
            title="Mark as Paid"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsPaid(row);
            }}
            disabled={row.balance <= 0}
          >
            <CheckCircle size={16} />
          </button>
          <button
            className="btn-icon"
            title="Record Payment"
            onClick={(e) => {
              e.stopPropagation();
              handlePartialPayment(row);
            }}
          >
            <Edit size={16} />
          </button>
          <a
            href={`/payments?landlord_id=${row.id}`}
            className="btn-icon"
            title="View Payments"
            onClick={(e) => e.stopPropagation()}
          >
            <LinkIcon size={16} />
          </a>
        </div>
      )
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
    <div className="page financial-overview-page">
      <Header title="Financial Overview" />
      <div className="page-content">
        {/* Summary Stats */}
        <div className="metrics-grid">
          <StatsCard
            title="Estate Balance"
            value={formatCurrency(accountBalance)}
            icon={Wallet}
            variant={accountBalance >= 0 ? 'success' : 'danger'}
          />
          <StatsCard
            title="Total Expected"
            value={formatCurrency(totals.totalExpected)}
            icon={DollarSign}
            variant="primary"
          />
          <StatsCard
            title="Total Paid"
            value={formatCurrency(totals.totalPaid)}
            icon={CheckCircle}
            variant="success"
          />
          <StatsCard
            title="Outstanding"
            value={formatCurrency(totals.totalOutstanding)}
            icon={AlertCircle}
            variant="warning"
          />
          <StatsCard
            title="Landlords"
            value={totals.landlordCount}
            icon={Users}
            variant="info"
          />
        </div>

        {/* Status Summary */}
        <div className="status-summary">
          <span className="status-item">
            <CheckCircle size={14} className="icon-success" /> {totals.paidCount} Paid
          </span>
          <span className="status-item">
            <AlertCircle size={14} className="icon-warning" /> {totals.partialCount} Partial
          </span>
          <span className="status-item">
            <Clock size={14} className="icon-danger" /> {totals.pendingCount} Pending
          </span>
        </div>

        {/* Filters and Actions */}
        <div className="page-header filters-sticky">
          <div className="filters-bar">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search landlords..."
                onChange={handleSearch}
              />
            </div>
            <div className="filter-group">
              <label>Payment Type</label>
              <select
                value={filters.paymentTypeId || ''}
                onChange={(e) => handleFilterChange('paymentTypeId', e.target.value)}
              >
                <option value="">All Types</option>
                {paymentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.paymentStatus || ''}
                onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="action-buttons">
            {selectedRows.length > 0 && (
              <>
                <span className="selected-count">{selectedRows.length} selected</span>
                <button className="btn btn-primary" onClick={handleAssign}>
                  <Plus size={16} /> Assign Type
                </button>
                <button className="btn btn-secondary" onClick={handleUnassign}>
                  <Minus size={16} /> Unassign Type
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleExportCSV}
              disabled={loadingExport}
            >
              <Download size={16} /> CSV
            </button>
            <PDFDownloadLink
              document={<FinancialReportPDF data={exportData.length > 0 ? exportData : data} totals={totals} filters={filters} />}
              fileName={`financial-overview-${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`}
              className="btn btn-secondary"
              onClick={prepareExportData}
            >
              {({ loading: pdfLoading }) => (
                <>
                  <FileText size={16} /> {pdfLoading ? 'Generating...' : 'PDF'}
                </>
              )}
            </PDFDownloadLink>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No landlords found matching your filters"
          pagination={pagination}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </div>

      {/* Bulk Assignment Modal */}
      <BulkAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        selectedLandlords={selectedRows}
        onSuccess={handleAssignmentSuccess}
        adminId={adminProfile?.id}
        mode={assignMode}
      />

      {/* Partial Payment Modal */}
      <PartialPaymentModal
        isOpen={showPartialModal}
        onClose={() => setShowPartialModal(false)}
        landlord={selectedLandlordForPartial}
        onSuccess={handlePartialPaymentSuccess}
        adminId={adminProfile?.id}
      />
    </div>
  );
};

export default FinancialOverviewPage;