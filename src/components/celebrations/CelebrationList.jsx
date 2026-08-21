import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CelebrationCard from './CelebrationCard';

const DAYS_TO_KEEP_SENT = 30;

const CelebrationList = ({ celebrations, loading, onAction, celebrationType }) => {
  const [collapsed, setCollapsed] = useState({ pending: false, sent: true });

  const toggleGroup = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isWithinWindow = (celebration) => {
    if (celebration.status !== 'sent') return true;
    const eventDate = new Date(celebration.celebration_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= DAYS_TO_KEEP_SENT;
  };

  if (loading) {
    return (
      <div className="celebration-list loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="celebration-card loading-skeleton"></div>
        ))}
      </div>
    );
  }

  const filtered = celebrations.filter(isWithinWindow);

  if (!filtered || filtered.length === 0) {
    return (
      <div className="empty-state">
        <p>No {celebrationType === 'birthday' ? 'birthday' : 'anniversary'} celebrations found.</p>
        <p className="empty-hint">
          Celebrations will appear here when landlords with opt-in enabled have upcoming events.
        </p>
      </div>
    );
  }

  // Group by status for better organization
  const grouped = {
    pending: filtered.filter(c => c.status === 'pending'),
    approved: filtered.filter(c => c.status === 'approved'),
    sent: filtered.filter(c => c.status === 'sent'),
    skipped: filtered.filter(c => c.status === 'skipped'),
  };

  const sections = [
    { key: 'pending', title: 'Pending Approval', data: grouped.pending, startCollapsed: false },
    { key: 'approved', title: 'Ready to Send', data: grouped.approved, startCollapsed: false },
    { key: 'sent', title: 'Sent', data: grouped.sent, startCollapsed: true },
    { key: 'skipped', title: 'Skipped', data: grouped.skipped, startCollapsed: false },
  ];

  return (
    <div className="celebration-list">
      {sections.map(({ key, title, data }) =>
        data.length > 0 ? (
          <div key={key} className="celebration-group">
            <h3 className="group-title collapsible" onClick={() => toggleGroup(key)}>
              <span className="group-title-text">{title} ({data.length})</span>
              {collapsed[key] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            </h3>
            {!collapsed[key] && (
              <div className="celebration-grid">
                {data.map((celebration) => (
                  <CelebrationCard
                    key={celebration.id}
                    celebration={celebration}
                    onAction={onAction}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null
      )}
    </div>
  );
};

export default CelebrationList;

