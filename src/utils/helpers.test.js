import { describe, it, expect } from 'vitest';
import {
  generateReferenceCode,
  generateReceiptNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  getMonthName,
  getStatusClass,
  isValidEmail,
  isValidPhone,
  truncateText,
  formatLandlordName,
} from './helpers';

describe('generateReferenceCode', () => {
  it('builds the ZD reference from the first 8 chars of the id, uppercased', () => {
    const code = generateReferenceCode('abcd1234efgh', 2026, 3, 'rent');
    expect(code).toBe('ZD-ABCD1234-2026-03-RENT');
  });

  it('zero-pads single-digit months', () => {
    const code = generateReferenceCode('11111111', 2025, 9, 'levy');
    expect(code).toContain('-2025-09-');
  });
});

describe('generateReceiptNumber', () => {
  it('matches the RCP-YYYYMMDD-XXXX format', () => {
    expect(generateReceiptNumber()).toMatch(/^RCP-\d{8}-[0-9A-Z]{2,4}$/);
  });

  it('produces unique-ish values across calls', () => {
    const values = new Set(Array.from({ length: 20 }, () => generateReceiptNumber()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('formatCurrency', () => {
  it('formats with the naira sign and two decimals', () => {
    expect(formatCurrency(1000)).toBe('₦1,000.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('₦0.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('₦1,234.50');
  });
});

describe('formatDate / formatDateTime', () => {
  it('returns a dash for empty values', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('formats a date with the default pattern', () => {
    expect(formatDate('2026-01-15T00:00:00Z')).toMatch(/Jan 1[45], 2026/);
  });
});

describe('getMonthName', () => {
  it('maps 1-based month numbers to names', () => {
    expect(getMonthName(1)).toBe('January');
    expect(getMonthName(12)).toBe('December');
  });

  it('returns an empty string for out-of-range months', () => {
    expect(getMonthName(0)).toBe('');
    expect(getMonthName(13)).toBe('');
  });
});

describe('getStatusClass', () => {
  it('maps known statuses to badge classes', () => {
    expect(getStatusClass('confirmed')).toBe('badge-success');
    expect(getStatusClass('pending')).toBe('badge-warning');
  });

  it('falls back to the default badge for unknown statuses', () => {
    expect(getStatusClass('whatever')).toBe('badge-default');
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts Nigerian formats with 0 or +234 prefix', () => {
    expect(isValidPhone('08031234567')).toBe(true);
    expect(isValidPhone('+2348031234567')).toBe(true);
  });

  it('ignores embedded whitespace', () => {
    expect(isValidPhone('0803 123 4567')).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('0603123456')).toBe(false);
  });
});

describe('truncateText', () => {
  it('returns the text unchanged when within the limit', () => {
    expect(truncateText('short', 50)).toBe('short');
  });

  it('appends an ellipsis when over the limit', () => {
    expect(truncateText('abcdefghij', 5)).toBe('abcde...');
  });

  it('passes through falsy values', () => {
    expect(truncateText('')).toBe('');
  });
});

describe('formatLandlordName', () => {
  it('prefixes the title when both are present', () => {
    expect(formatLandlordName({ title: 'Mr', full_name: 'John Doe' })).toBe('Mr John Doe');
  });

  it('returns the name alone when no title', () => {
    expect(formatLandlordName({ full_name: 'Jane' })).toBe('Jane');
  });

  it('returns an empty string for a nullish landlord', () => {
    expect(formatLandlordName(null)).toBe('');
  });
});
