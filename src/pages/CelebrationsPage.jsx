import { useState, useEffect } from 'react';
import { Cake, Heart, RefreshCw } from 'lucide-react';
import Header from '../components/layout/Header';
import CelebrationList from '../components/celebrations/CelebrationList';
import { celebrationService } from '../services/celebrationService';

const CelebrationsPage = () => {
  const [activeTab, setActiveTab] = useState('birthday');
  const [celebrations, setCelebrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState({ birthdays: 0, anniversaries: 0 });

  useEffect(() => {
    loadCelebrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadCelebrations = async () => {
    try {
      setLoading(true);
      const [data, todayCounts] = await Promise.all([
        celebrationService.getByType(activeTab),
        celebrationService.getTodayCounts(),
      ]);
      setCelebrations(data || []);
      setCounts(todayCounts);
    } catch (error) {
      console.error('Error loading celebrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Populate celebrations_queue first (in case cron hasn't run yet)
      await celebrationService.runCheck();
    } catch (error) {
      // If the function isn't deployed/available, still allow UI reload
      console.warn('Celebration check failed (continuing to reload):', error);
    }
    await loadCelebrations();
    setRefreshing(false);
  };

  const handleAction = async (action) => {
    try {
      if (action === 'reload') {
        await loadCelebrations();
      }
    } catch (error) {
      console.error('Error handling action:', error);
    }
  };

  const tabs = [
    { id: 'birthday', label: 'Birthdays', icon: Cake, count: counts.birthdays },
    { id: 'anniversary', label: 'Anniversaries', icon: Heart, count: counts.anniversaries },
  ];

  return (
    <div className="page celebrations-page">
      <Header title="Celebrations" />
      <div className="page-content">
        <div className="page-header">
          <div className="page-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="tab-badge">{tab.count}</span>
                )}
              </button>
            ))}
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

        <CelebrationList
          celebrations={celebrations}
          loading={loading}
          onAction={handleAction}
          celebrationType={activeTab}
        />
      </div>
    </div>
  );
};

export default CelebrationsPage;

