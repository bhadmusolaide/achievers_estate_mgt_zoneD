import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, UserX, UserCheck } from 'lucide-react';
import Header from '../components/layout/Header';
import DataTable from '../components/common/DataTable';
import SearchFilter from '../components/common/SearchFilter';
import Modal from '../components/common/Modal';
import LandlordForm from '../components/landlords/LandlordForm';
import LandlordProfile from '../components/landlords/LandlordProfile';
import { landlordService } from '../services/landlordService';
import { getStatusClass } from '../utils/helpers';

const LandlordsPage = () => {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedLandlord, setSelectedLandlord] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    loadLandlords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortConfig]);

  const loadLandlords = async () => {
    try {
      const data = await landlordService.getAll(filters, sortConfig);
      setLandlords(data);
    } catch (error) {
      console.error('Error loading landlords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search) => {
    setFilters(prev => ({ ...prev, search }));
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleAdd = () => {
    setSelectedLandlord(null);
    setModalMode('add');
    setShowModal(true);
  };

  const handleView = async (landlord) => {
    const full = await landlordService.getById(landlord.id);
    const summary = await landlordService.getPaymentSummary(landlord.id);
    setSelectedLandlord(full);
    setPaymentSummary(summary);
    setModalMode('view');
    setShowModal(true);
  };

  const handleEdit = async (landlord) => {
    const full = await landlordService.getById(landlord.id);
    setSelectedLandlord(full);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleToggleStatus = async (landlord) => {
    try {
      if (landlord.status === 'active') {
        await landlordService.deactivate(landlord.id);
      } else {
        await landlordService.activate(landlord.id);
      }
      loadLandlords();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await landlordService.create(formData);
      } else {
        await landlordService.update(selectedLandlord.id, formData);
      }
      setShowModal(false);
      loadLandlords();
    } catch (error) {
      console.error('Error saving landlord:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'full_name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Phone', sortable: true },
    { key: 'house_address', header: 'Address', sortable: true },
    { key: 'road', header: 'Road', sortable: true },
    {
      key: 'occupancy_type',
      header: 'Type',
      sortable: true,
      render: (row) => <span className="capitalize">{row.occupancy_type}</span>
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={`badge ${getStatusClass(row.status)}`}>
            {row.status}
          </span>
          {row.onboarding_status === 'pending' && (
            <span className="badge badge-warning" title="Onboarding pending - cannot process payments">
              Pending Onboarding
            </span>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="table-actions">
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleView(row); }} title="View">
            <Eye size={16} />
          </button>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} title="Edit">
            <Edit size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(row); }}
            title={row.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {row.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
          </button>
        </div>
      )
    }
  ];

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ]
    },
    {
      key: 'onboarding_status',
      label: 'Onboarding',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'active', label: 'Completed' },
      ]
    },
    {
      key: 'occupancy_type',
      label: 'Occupancy',
      options: [
        { value: 'owner', label: 'Owner' },
        { value: 'tenant', label: 'Tenant' },
      ]
    },
    {
      key: 'road',
      label: 'Road',
      type: 'text',
      placeholder: 'e.g., Road 1'
    }
  ];

  return (
    <div className="page landlords-page">
      <Header title="Landlords" />
      <div className="page-content">
        <div className="page-header">
          <SearchFilter
            searchPlaceholder="Search landlords..."
            onSearch={handleSearch}
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            activeFilters={filters}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={18} /> Add Landlord
          </button>
        </div>
        <DataTable
          columns={columns}
          data={landlords}
          loading={loading}
          emptyMessage="No landlords found"
          sortConfig={sortConfig}
          onSort={(key) => {
            let direction = 'asc';
            if (sortConfig.key === key) {
              direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            }
            setSortConfig({ key, direction });
          }}
        />
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={modalMode === 'add' ? 'Add Landlord' : modalMode === 'edit' ? 'Edit Landlord' : 'Landlord Profile'} size="medium">
        {modalMode === 'view' ? (
          <LandlordProfile landlord={selectedLandlord} paymentSummary={paymentSummary} />
        ) : (
          <LandlordForm landlord={selectedLandlord} onSubmit={handleSubmit} onCancel={() => setShowModal(false)} loading={saving} />
        )}
      </Modal>
    </div>
  );
};

export default LandlordsPage;

