import { Link } from 'react-router-dom';
import { Cake, Heart, Calendar, ArrowRight } from 'lucide-react';

const CelebrationAlerts = ({ counts, loading }) => {
  if (loading) {
    return (
      <div className="celebration-alerts">
        <div className="alerts-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="alert-card loading-skeleton"></div>
          ))}
        </div>
      </div>
    );
  }

  const hasAlerts = counts && (counts.birthdays > 0 || counts.anniversaries > 0 || counts.upcoming > 0);

  if (!hasAlerts) {
    return null;
  }

  return (
    <div className="celebration-alerts">
      <div className="alerts-header">
        <h3>🎉 Celebration Alerts</h3>
        <Link to="/celebrations" className="btn btn-link">
          View All <ArrowRight size={16} />
        </Link>
      </div>

      <div className="alerts-grid">
        {counts.birthdays > 0 && (
          <Link to="/celebrations" className="alert-card alert-birthday">
            <div className="alert-icon">
              <Cake size={24} />
            </div>
            <div className="alert-content">
              <span className="alert-count">{counts.birthdays}</span>
              <span className="alert-label">Birthday{counts.birthdays !== 1 ? 's' : ''} Today</span>
            </div>
          </Link>
        )}

        {counts.anniversaries > 0 && (
          <Link to="/celebrations" className="alert-card alert-anniversary">
            <div className="alert-icon">
              <Heart size={24} />
            </div>
            <div className="alert-content">
              <span className="alert-count">{counts.anniversaries}</span>
              <span className="alert-label">Anniversary{counts.anniversaries !== 1 ? 'ies' : ''} Today</span>
            </div>
          </Link>
        )}

        {counts.upcoming > 0 && (
          <Link to="/celebrations" className="alert-card alert-upcoming">
            <div className="alert-icon">
              <Calendar size={24} />
            </div>
            <div className="alert-content">
              <span className="alert-count">{counts.upcoming}</span>
              <span className="alert-label">Upcoming (3 days)</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
};

export default CelebrationAlerts;

