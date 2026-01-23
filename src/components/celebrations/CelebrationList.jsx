import CelebrationCard from './CelebrationCard';

const CelebrationList = ({ celebrations, loading, onAction, celebrationType }) => {
  if (loading) {
    return (
      <div className="celebration-list loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="celebration-card loading-skeleton"></div>
        ))}
      </div>
    );
  }

  if (!celebrations || celebrations.length === 0) {
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
    pending: celebrations.filter(c => c.status === 'pending'),
    approved: celebrations.filter(c => c.status === 'approved'),
    sent: celebrations.filter(c => c.status === 'sent'),
    skipped: celebrations.filter(c => c.status === 'skipped'),
  };

  return (
    <div className="celebration-list">
      {grouped.pending.length > 0 && (
        <div className="celebration-group">
          <h3 className="group-title">Pending Approval ({grouped.pending.length})</h3>
          <div className="celebration-grid">
            {grouped.pending.map((celebration) => (
              <CelebrationCard
                key={celebration.id}
                celebration={celebration}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.approved.length > 0 && (
        <div className="celebration-group">
          <h3 className="group-title">Ready to Send ({grouped.approved.length})</h3>
          <div className="celebration-grid">
            {grouped.approved.map((celebration) => (
              <CelebrationCard
                key={celebration.id}
                celebration={celebration}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.sent.length > 0 && (
        <div className="celebration-group">
          <h3 className="group-title">Sent ({grouped.sent.length})</h3>
          <div className="celebration-grid">
            {grouped.sent.map((celebration) => (
              <CelebrationCard
                key={celebration.id}
                celebration={celebration}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.skipped.length > 0 && (
        <div className="celebration-group">
          <h3 className="group-title">Skipped ({grouped.skipped.length})</h3>
          <div className="celebration-grid">
            {grouped.skipped.map((celebration) => (
              <CelebrationCard
                key={celebration.id}
                celebration={celebration}
                onAction={onAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CelebrationList;

