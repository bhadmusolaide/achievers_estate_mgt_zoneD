import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toastService from '../services/toastService';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Register this instance with the toast service
  useEffect(() => {
    toastService.setInstance({
      success: (message, duration) => addToast(message, 'success', duration),
      error: (message, duration) => addToast(message, 'error', duration),
      info: (message, duration) => addToast(message, 'info', duration),
      warning: (message, duration) => addToast(message, 'warning', duration),
    });

    // Cleanup on unmount
    return () => {
      toastService.setInstance(null);
    };
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = uuidv4();
    const toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message, duration = 5000) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message, duration = 7000) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const info = useCallback((message, duration = 5000) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  const warning = useCallback((message, duration = 6000) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export default ToastContext;
