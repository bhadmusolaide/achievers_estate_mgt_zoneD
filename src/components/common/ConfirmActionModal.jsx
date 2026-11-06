import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Confirmation modal for critical actions
 * Used for: Bulk charge creation, CSV import, Payment confirmation,
 * Receipt send, Celebration send, Onboarding completion
 */
const ConfirmActionModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionType,
  summary,
  details = [],
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  variant = 'warning', // 'warning', 'danger', 'info'
}) => {
  const variantStyles = {
    warning: {
      iconColor: 'var(--warning)',
      confirmClass: 'btn-primary',
    },
    danger: {
      iconColor: 'var(--danger)',
      confirmClass: 'btn-danger',
    },
    info: {
      iconColor: 'var(--info)',
      confirmClass: 'btn-primary',
    },
  };

  const style = variantStyles[variant] || variantStyles.warning;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="confirm-action-modal">
        <div className="confirm-icon" style={{ color: style.iconColor }}>
          <AlertTriangle size={48} />
        </div>
        
        <div className="confirm-header">
          <h3>Confirm Action</h3>
          {actionType && <span className="action-type-badge">{actionType}</span>}
        </div>
        
        <p className="confirm-summary">{summary}</p>
        
        {details.length > 0 && (
          <div className="confirm-details">
            <h4>Impact Summary</h4>
            <ul>
              {details.map((detail, index) => (
                <li key={index}>
                  <span className="detail-label">{detail.label}:</span>
                  <span className="detail-value">{detail.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="confirm-warning">
          <AlertTriangle size={16} />
          <span>This action will be logged in the audit trail.</span>
        </div>
        
        <div className="confirm-actions">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${style.confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmActionModal;

