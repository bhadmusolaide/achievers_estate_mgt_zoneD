import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const Toast = ({ id, message, type = 'info', duration = 5000, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration > 0) {
      const startTime = Date.now();
      const endTime = startTime + duration;

      const updateProgress = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const percentage = (remaining / duration) * 100;
        setProgress(percentage);

        if (remaining > 0) {
          requestAnimationFrame(updateProgress);
        }
      };

      const progressInterval = requestAnimationFrame(updateProgress);

      const timeoutId = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearTimeout(timeoutId);
        cancelAnimationFrame(progressInterval);
      };
    }
  }, [duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const getIcon = () => {
    const iconProps = { size: 20, className: 'toast-icon' };
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'warning':
        return <AlertTriangle {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  const getToastClass = () => {
    const baseClasses = 'toast';
    const typeClasses = {
      success: 'toast-success',
      error: 'toast-error',
      warning: 'toast-warning',
      info: 'toast-info',
    };
    const closingClass = isClosing ? 'toast-closing' : '';
    return `${baseClasses} ${typeClasses[type]} ${closingClass}`;
  };

  return (
    <div className={getToastClass()} role="alert" aria-live="polite">
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{message}</span>
        <button
          className="toast-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
      {duration > 0 && (
        <div 
          className="toast-progress" 
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export { Toast, ToastContainer };
export default Toast;
