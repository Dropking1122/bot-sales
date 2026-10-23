export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
];
export const MAX_EXCEL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMPORT_ROWS = 5000;

export const BROADCAST_CONCURRENCY_DEFAULT = 1;
export const BROADCAST_DELAY_BETWEEN_MESSAGES_MS = 2500; // 2.5s delay to prevent account flag

/**
 * Normalizes phone numbers to international standard (628xxx for Indonesia).
 * Strips +, -, spaces, parentheses.
 */
export function normalizePhoneNumber(rawNumber: string): string {
  if (!rawNumber) return '';
  let cleaned = rawNumber.trim().replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Indonesian format: 08xx -> 628xx
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

/**
 * Validates Indonesian or international phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Indonesian WhatsApp numbers are 628... with total 10 to 15 digits
  return /^628[1-9][0-9]{7,11}$/.test(normalized) || /^[1-9][0-9]{8,14}$/.test(normalized);
}

/**
 * Formula injection protection for CSV / Excel cells
 * Prepends a single quote if string starts with dangerous characters =, +, -, @, \t, \r
 */
export function sanitizeForExcel(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format IDR currency
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}
