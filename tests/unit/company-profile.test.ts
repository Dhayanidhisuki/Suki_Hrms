/**
 * Letterhead address formatting.
 *
 * The address on a generated document used to be a hard-coded KUN constant,
 * with Company.description regex-sniffed for "chennai|plot|estate" to decide
 * whether it happened to hold one. It now comes from the Company record.
 */

import { describe, it, expect } from 'vitest';
import { formatCompanyAddress } from '@/lib/company-profile';

describe('formatCompanyAddress', () => {
  it('builds one line from the structured fields', () => {
    expect(
      formatCompanyAddress({
        addressLine1: 'Plot No. 22 & 23, Ambattur Industrial Estate',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600058',
      }),
    ).toBe('Plot No. 22 & 23, Ambattur Industrial Estate, Chennai, Tamil Nadu - 600058');
  });

  it('includes the second address line when present', () => {
    expect(
      formatCompanyAddress({ addressLine1: 'Unit 4', addressLine2: 'Tower B', city: 'Pune' }),
    ).toBe('Unit 4, Tower B, Pune');
  });

  it('omits missing parts instead of leaving stray separators', () => {
    // A pincode with no city/state must not leave a dangling " - ".
    expect(formatCompanyAddress({ addressLine1: 'Unit 4', pincode: '411001' })).toBe('Unit 4, 411001');
    expect(formatCompanyAddress({ city: 'Chennai', state: 'Tamil Nadu' })).toBe('Chennai, Tamil Nadu');
    expect(formatCompanyAddress({ addressLine1: 'Unit 4' })).toBe('Unit 4');
  });

  it('falls back to description for companies predating the address columns', () => {
    expect(formatCompanyAddress({ description: '12 Old Street, Coimbatore' })).toBe('12 Old Street, Coimbatore');
  });

  it('prefers the real fields over description once they are filled in', () => {
    expect(
      formatCompanyAddress({ addressLine1: 'New Plot 9', city: 'Madurai', description: 'stale address' }),
    ).toBe('New Plot 9, Madurai');
  });

  it('returns an empty string when the company has no address at all', () => {
    // A company with no address prints no address line — it must never
    // silently borrow another company's.
    expect(formatCompanyAddress({})).toBe('');
    expect(formatCompanyAddress({ description: '   ' })).toBe('');
  });

  it('ignores whitespace-only fields', () => {
    expect(formatCompanyAddress({ addressLine1: '  ', city: 'Chennai' })).toBe('Chennai');
  });
});
