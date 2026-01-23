import { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, Users, CheckSquare } from 'lucide-react';
import Header from '../components/layout/Header';
import StatsCard from '../components/common/StatsCard';
import OnboardingLandlordCard from '../components/onboarding/OnboardingLandlordCard';
import OnboardingTaskModal from '../components/onboarding/OnboardingTaskModal';
import { onboardingService } from '../services/onboardingService';
import { useAuth } from '../context/AuthContext';

const OnboardingPage = () => {
  const { adminProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingLandlords, setPendingLandlords] = useState([]);
  const [completedLandlords, setCompletedLandlords] = useState([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedLandlord, setSelectedLandlord] = useState(null);
  const [selectedLandlordIds, setSelectedLandlordIds] = useState(new Set());
  const [bulkCompleting, setBulkCompleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, completed, statsData] = await Promise.all([
        onboardingService.getPendingLandlords(),
        onboardingService.getCompletedLandlords(),
        onboardingService.getStats(),
      ]);
      setPendingLandlords(pending);
      setCompletedLandlords(completed);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTasks = (landlord) => {
    setSelectedLandlord(landlord);
  };

  const handleCloseModal = () => {
    setSelectedLandlord(null);
    loadData(); // Refresh data after modal closes
  };

  const handleSelectLandlord = (landlordId, checked) => {
    setSelectedLandlordIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(landlordId);
      } else {
        newSet.delete(landlordId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allPendingIds = new Set(pendingLandlords.map((l) => l.id));
      setSelectedLandlordIds(allPendingIds);
    } else {
      setSelectedLandlordIds(new Set());
    }
  };

  const handleBulkMarkCompleted = async () => {
    if (selectedLandlordIds.size === 0) return;

    if (!confirm(`Mark ${selectedLandlordIds.size} landlord(s) as completed?`)) {
      return;
    }

    setBulkCompleting(true);
    try {
      await onboardingService.bulkMarkCompleted(
        Array.from(selectedLandlordIds),
        adminProfile?.id
      );
      setSelectedLandlordIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error marking landlords as completed:', error);
      alert('Failed to mark landlords as completed. Please try again.');
    } finally {
      setBulkCompleting(false);
    }
  };

  const currentList = activeTab === 'pending' ? pendingLandlords : completedLandlords;
  const allSelected = activeTab === 'pending' && pendingLandlords.length > 0 && 
    selectedLandlordIds.size === pendingLandlords.length;
  const someSelected = selectedLandlordIds.size > 0;

  return (
    <div className="page onboarding-page">
      <Header title="Landlord Onboarding" />

      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>Onboarding Dashboard</h2>
            <p>Track and manage new landlord onboarding</p>
          </div>
          <div className="header-actions">
            {activeTab === 'pending' && someSelected && (
              <button
                className="btn btn-primary"
                onClick={handleBulkMarkCompleted}
                disabled={bulkCompleting || loading}
              >
                <CheckSquare size={18} />
                Mark Completed ({selectedLandlordIds.size})
              </button>
            )}
            <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <StatsCard
            title="Pending Onboarding"
            value={stats.pending}
            icon={Clock}
            color="warning"
            loading={loading}
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            icon={CheckCircle}
            color="success"
            loading={loading}
          />
          <StatsCard
            title="Total Landlords"
            value={stats.pending + stats.completed}
            icon={Users}
            color="primary"
            loading={loading}
          />
        </div>

        {/* Tabs */}
        <div className="page-tabs">
          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              setSelectedLandlordIds(new Set()); // Clear selection when switching tabs
            }}
          >
            <Clock size={18} />
            Pending
            {stats.pending > 0 && <span className="tab-badge">{stats.pending}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('completed');
              setSelectedLandlordIds(new Set()); // Clear selection when switching tabs
            }}
          >
            <CheckCircle size={18} />
            Completed
          </button>
        </div>

        {/* Selection Controls - Only show for pending tab */}
        {activeTab === 'pending' && pendingLandlords.length > 0 && (
          <div className="selection-controls">
            <label className="select-all-checkbox">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelected && !allSelected;
                  }
                }}
              />
              <span>
                {allSelected ? 'Deselect All' : someSelected ? `Select All (${selectedLandlordIds.size} selected)` : 'Select All'}
              </span>
            </label>
          </div>
        )}

        {/* Landlord List */}
        <div className="onboarding-list">
          {loading ? (
            <div className="loading-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card loading-skeleton" style={{ height: '180px' }}></div>
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="empty-state">
              <p>
                {activeTab === 'pending'
                  ? 'No landlords pending onboarding'
                  : 'No completed onboardings yet'}
              </p>
            </div>
          ) : (
            <div className="landlord-grid">
              {currentList.map((landlord) => (
                <OnboardingLandlordCard
                  key={landlord.id}
                  landlord={landlord}
                  onViewTasks={() => handleViewTasks(landlord)}
                  isSelected={selectedLandlordIds.has(landlord.id)}
                  onSelect={activeTab === 'pending' ? handleSelectLandlord : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Modal */}
      {selectedLandlord && (
        <OnboardingTaskModal
          landlord={selectedLandlord}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default OnboardingPage;

