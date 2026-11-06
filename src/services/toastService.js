/**
 * Toast Service
 * Provides a way to show toast notifications from anywhere in the app
 * This service is used by both React components and non-React code (services)
 */

let toastInstance = null;

export const toastService = {
  /**
   * Set the toast instance (called by ToastProvider)
   */
  setInstance(instance) {
    toastInstance = instance;
  },

  /**
   * Show a success toast
   */
  success(message, duration = 5000) {
    if (toastInstance) {
      toastInstance.success(message, duration);
    } else {
      console.log('SUCCESS:', message);
    }
  },

  /**
   * Show an error toast
   */
  error(message, duration = 7000) {
    if (toastInstance) {
      toastInstance.error(message, duration);
    } else {
      console.error('ERROR:', message);
    }
  },

  /**
   * Show an info toast
   */
  info(message, duration = 5000) {
    if (toastInstance) {
      toastInstance.info(message, duration);
    } else {
      console.log('INFO:', message);
    }
  },

  /**
   * Show a warning toast
   */
  warning(message, duration = 6000) {
    if (toastInstance) {
      toastInstance.warning(message, duration);
    } else {
      console.warn('WARNING:', message);
    }
  },
};

export default toastService;
