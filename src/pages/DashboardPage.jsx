import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import Header from '../components/layout/Header';
import DashboardMetrics from '../components/dashboard/DashboardMetrics';
import RecentPayments from '../components/dashboard/RecentPayments';
import CelebrationAlerts from '../components/dashboard/CelebrationAlerts';
import UpcomingCelebrationsAlert from '../components/dashboard/UpcomingCelebrationsAlert';
import { dashboardService } from '../services/dashboardService';
import { celebrationService } from '../services/celebrationService';
import { notificationPreferencesService } from '../services/notificationPreferencesService';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const { adminProfile } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [celebrationCounts, setCelebrationCounts] = useState(null);
  const [upcomingCelebrations, setUpcomingCelebrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      const [metricsData, paymentsData, todayCounts, upcomingCount, alertsEnabled, upcomingCelebrationsData] = await Promise.all([
        dashboardService.getMetrics(),
        dashboardService.getRecentPayments(5),
        celebrationService.getTodayCounts(),
        celebrationService.getUpcomingCount(),
        adminProfile?.id
          ? notificationPreferencesService.isNotificationEnabled(adminProfile.id, 'dashboard_alerts')
          : true,
        dashboardService.getUpcomingCelebrations(),
      ]);
      setMetrics(metricsData);
      setRecentPayments(paymentsData);
      setCelebrationCounts({
        ...todayCounts,
        upcoming: upcomingCount,
      });
      setUpcomingCelebrations(upcomingCelebrationsData);
      setShowAlerts(alertsEnabled);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <div className="page dashboard-page">
      <Header title="Dashboard" />
      
      <div className="page-content">
        <div className="page-header">
          <div>
            <h2>Welcome back, {adminProfile?.full_name}</h2>
            <p>Here's what's happening in your estate</p>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        <DashboardMetrics metrics={metrics} loading={loading} />

        {showAlerts && (
          <CelebrationAlerts counts={celebrationCounts} loading={loading} />
        )}

        {showAlerts && (
          <UpcomingCelebrationsAlert celebrations={upcomingCelebrations} loading={loading} />
        )}

        <div className="dashboard-sections">
          <div className="dashboard-section">
            <div className="section-header">
              <h3>Recent Payments</h3>
              <Link to="/payments" className="btn btn-link">
                View All <ArrowRight size={16} />
              </Link>
            </div>
            <RecentPayments payments={recentPayments} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

