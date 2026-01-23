import { useState } from 'react';
import { User, MapPin, Calendar, Clock, CheckCircle, XCircle, Send, Edit2, Phone, Mail } from 'lucide-react';
import Modal from '../common/Modal';
import CelebrationActions from './CelebrationActions';
import MessageEditor from './MessageEditor';
import { formatDate } from '../../utils/helpers';

const CelebrationCard = ({ celebration, onAction }) => {
  const [showActions, setShowActions] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const { landlords: landlord } = celebration;

  const getStatusBadge = () => {
    const statusConfig = {
      pending: { class: 'badge-warning', label: 'Pending' },
      approved: { class: 'badge-info', label: 'Approved' },
      sent: { class: 'badge-success', label: 'Sent' },
      skipped: { class: 'badge-secondary', label: 'Skipped' },
    };
    const config = statusConfig[celebration.status] || statusConfig.pending;
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const getDaysLabel = () => {
    if (celebration.days_to_event === 0) return 'Today!';
    if (celebration.days_to_event === 1) return 'Tomorrow';
    return `In ${celebration.days_to_event} days`;
  };

  const handleActionComplete = () => {
    setShowActions(false);
    setShowEditor(false);
    onAction('reload', celebration);
  };

  return (
    <>
      <div className={`celebration-card status-${celebration.status}`}>
        <div className="card-header">
          <div className="landlord-info">
            <div className="avatar">
              <User size={20} />
            </div>
            <div>
              <h4>{landlord?.full_name || 'Unknown'}</h4>
              <span className="address">
                <MapPin size={14} />
                {landlord?.house_address || 'N/A'}
              </span>
              {landlord?.road && (
                <div className="road-info">
                  <span className="road-label">{landlord?.road}</span>
                </div>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        <div className="card-body">
          <div className="celebration-details">
            <div className="detail-row">
              <Calendar size={16} />
              <span>{formatDate(celebration.celebration_date)}</span>
            </div>
            <div className="detail-row highlight">
              <Clock size={16} />
              <span className={celebration.days_to_event === 0 ? 'today' : ''}>
                {getDaysLabel()}
              </span>
            </div>
            {landlord?.phone && (
              <div className="detail-row">
                <Phone size={16} />
                <span>{landlord.phone}</span>
              </div>
            )}
            {landlord?.email && (
              <div className="detail-row">
                <Mail size={16} />
                <span>{landlord.email}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card-footer">
          {(celebration.computed || celebration.status === 'pending') && (
            <>
              <button className="btn btn-sm btn-primary" onClick={() => setShowActions(true)}>
                <CheckCircle size={14} /> {celebration.computed ? 'Queue & Approve' : 'Approve'}
              </button>
              {!celebration.computed && (
                <button className="btn btn-sm btn-secondary" onClick={() => setShowEditor(true)}>
                  <Edit2 size={14} /> Edit
                </button>
              )}
            </>
          )}
          {!celebration.computed && celebration.status === 'approved' && (
            <>
              <button className="btn btn-sm btn-success" onClick={() => setShowActions(true)}>
                <Send size={14} /> Send
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowEditor(true)}>
                <Edit2 size={14} /> Edit
              </button>
            </>
          )}
          {!celebration.computed && celebration.status === 'sent' && (
            <span className="sent-info">
              Sent via {celebration.sent_via} on {formatDate(celebration.sent_at)}
            </span>
          )}
          {!celebration.computed && celebration.status === 'skipped' && (
            <span className="skipped-info">
              Skipped on {formatDate(celebration.skipped_at)}
            </span>
          )}
        </div>
      </div>

      <Modal
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        title={`${celebration.celebration_type === 'birthday' ? 'Birthday' : 'Anniversary'} Actions`}
        size="medium"
      >
        <CelebrationActions
          celebration={celebration}
          onComplete={handleActionComplete}
          onCancel={() => setShowActions(false)}
        />
      </Modal>

      <Modal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        title="Edit Message"
        size="large"
      >
        <MessageEditor
          celebration={celebration}
          onSave={handleActionComplete}
          onCancel={() => setShowEditor(false)}
        />
      </Modal>
    </>
  );
};

export default CelebrationCard;

