/**
 * Document expiry calculation utilities.
 * Expiry status is a derived field — computed at runtime, not stored in DB.
 */

export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';

export function getDaysToExpiry(expiryDate: Date | string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(expiryDate: Date | string | null): ExpiryStatus {
  if (!expiryDate) return 'no_expiry';
  const days = getDaysToExpiry(expiryDate);
  if (days === null) return 'no_expiry';
  if (days < 0) return 'expired';
  if (days <= EXPIRY_WARNING_DAYS) return 'expiring_soon';
  return 'valid';
}

export interface DocumentWithExpiry {
  expiryDate: Date | string | null;
  expiryStatus: ExpiryStatus;
  daysToExpiry: number | null;
}

export function annotateDocumentExpiry<
  T extends { expiryDate: Date | string | null }
>(doc: T): T & DocumentWithExpiry {
  return {
    ...doc,
    expiryStatus: getExpiryStatus(doc.expiryDate),
    daysToExpiry: getDaysToExpiry(doc.expiryDate),
  };
}

export interface ExpirySummary {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
  noExpiry: number;
}

export function summarizeExpiry<
  T extends { expiryDate: Date | string | null }
>(docs: T[]): ExpirySummary {
  const summary: ExpirySummary = {
    total: docs.length,
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    noExpiry: 0,
  };
  for (const doc of docs) {
    const status = getExpiryStatus(doc.expiryDate);
    switch (status) {
      case 'expired':
        summary.expired++;
        break;
      case 'expiring_soon':
        summary.expiringSoon++;
        break;
      case 'valid':
        summary.valid++;
        break;
      case 'no_expiry':
        summary.noExpiry++;
        break;
    }
  }
  return summary;
}
