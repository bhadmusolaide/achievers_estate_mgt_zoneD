import { format } from 'date-fns';

/**
 * Generate a unique reference code for payments
 * Format: ZD-LANDLORDID-YEAR-MONTH-TYPE
 */
export const generateReferenceCode = (landlordId, year, month, paymentType) => {
  const shortId = landlordId.slice(0, 8).toUpperCase();
  const monthStr = String(month).padStart(2, '0');
  return `ZD-${shortId}-${year}-${monthStr}-${paymentType.toUpperCase()}`;
};

/**
 * Generate a human-readable receipt number
 * Format: RCP-YYYYMMDD-XXXX
 */
export const generateReceiptNumber = () => {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${date}-${random}`;
};

/**
 * Format currency (Nigerian Naira)
 */
export const formatCurrency = (amount) => {
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

/**
 * Format date for display
 */
export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
  if (!date) return '-';
  return format(new Date(date), formatStr);
};

/**
 * Format date and time for display
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

/**
 * Get month name from month number
 */
export const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
};

/**
 * Get status badge class
 */
export const getStatusClass = (status) => {
  const classes = {
    active: 'badge-success',
    inactive: 'badge-warning',
    pending: 'badge-warning',
    confirmed: 'badge-success',
  };
  return classes[status] || 'badge-default';
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Nigerian format)
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Title options for landlords (African context)
 */
export const TITLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Mr', label: 'Mr' },
  { value: 'Mrs', label: 'Mrs' },
  { value: 'Miss', label: 'Miss' },
  { value: 'Ms', label: 'Ms' },
  { value: 'Dr', label: 'Dr' },
  { value: 'Prof', label: 'Prof' },
  { value: 'Engr', label: 'Engr' },
  { value: 'Arc', label: 'Arc' },
  { value: 'Barr', label: 'Barr' },
  { value: 'Chief', label: 'Chief' },
  { value: 'Alhaji', label: 'Alhaji' },
  { value: 'Alhaja', label: 'Alhaja' },
  { value: 'Pastor', label: 'Pastor' },
  { value: 'Rev', label: 'Rev' },
  { value: 'Elder', label: 'Elder' },
  { value: 'Deacon', label: 'Deacon' },
  { value: 'Deaconess', label: 'Deaconess' },
  { value: 'Hon', label: 'Hon' },
  { value: 'Sir', label: 'Sir' },
  { value: 'Dame', label: 'Dame' },
];

/**
 * Format landlord display name with title
 * @param {Object} landlord - Landlord object with title and full_name
 * @returns {string} Formatted name with title prefix
 */
export const formatLandlordName = (landlord) => {
  if (!landlord) return '';
  const { title, full_name } = landlord;
  if (title && full_name) {
    return `${title} ${full_name}`;
  }
  return full_name || '';
};

