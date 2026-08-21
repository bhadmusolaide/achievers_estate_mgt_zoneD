import { useState } from 'react';
import { Upload, DollarSign } from 'lucide-react';
import BulkImportLandlords from '../components/landlords/BulkImportLandlords';
import BulkImportFinancials from '../components/financial/BulkImportFinancials';
import Header from '../components/layout/Header';

const TABS = [
  { id: 'landlords', label: 'Landlords', icon: Upload },
  { id: 'financials', label: 'Financial Data', icon: DollarSign },
];

const BulkImportPage = () => {
  const [activeTab, setActiveTab] = useState('landlords');

  return (
    <div className="page bulk-import-page">
      <Header title="Bulk Import" />
      <div className="page-content">
        {/* Tab Navigation */}
        <div className="tabs-container" style={{ marginBottom: '1rem' }}>
          <div className="tabs" style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  background: activeTab === tab.id ? '#fff' : 'transparent',
                  color: activeTab === tab.id ? '#2563eb' : '#6b7280',
                  borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                }}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'landlords' && <BulkImportLandlords />}
        {activeTab === 'financials' && <BulkImportFinancials />}
      </div>
    </div>
  );
};

export default BulkImportPage;