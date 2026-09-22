/**
 * Letter body selection.
 *
 * The body used to be chosen by case-sensitive substring match on the display
 * title, so a caller passing "Service Letter" instead of "SERVICE CERTIFICATE"
 * fell through to the default branch and silently produced *relieving letter*
 * text — the wrong document, under the right heading. Selection is now keyed
 * on LetterType, with title matching kept only as a case-insensitive fallback.
 */

import { describe, it, expect } from 'vitest';
import { letterBody, type LetterFields } from '@/lib/letters/generate-letter';

const fields: LetterFields = {
  companyName: 'KUN Motoren Private Limited',
  personName: 'Divya Ramesh',
  employeeCode: 'EMP027',
  designation: 'Senior Engineer',
  department: 'Production',
  joinDate: new Date('2025-01-06'),
};

const body = (...args: Parameters<typeof letterBody>) => letterBody(...args).join(' ');

describe('letterBody', () => {
  it('uses the letter type even when the title is worded differently', () => {
    const text = body('Service Letter', fields, 'SERVICE_LETTER');
    expect(text).toContain('was employed as');
    expect(text).not.toContain('relieved from services');
  });

  it('no longer falls through to relieving text on a lowercase title', () => {
    // The exact regression: this combination used to yield the relieving body.
    expect(body('Service Letter', fields)).not.toContain('relieved from services');
  });

  it('still produces relieving text when that is what was asked for', () => {
    expect(body('RELIEVING LETTER', fields, 'COMPANY_RELIEVING')).toContain('relieved from services');
  });

  it('distinguishes each letter type', () => {
    expect(body('x', fields, 'OFFER_LETTER')).toContain('pleased to offer');
    expect(body('x', fields, 'APPOINTMENT_LETTER')).toContain('hereby appointed');
    expect(body('x', fields, 'WARNING_LETTER')).toContain('warning regarding');
    expect(body('x', fields, 'SHOW_CAUSE')).toContain('required to explain');
    expect(body('x', fields, 'BONAFIDE')).toContain('bona fide employee');
  });

  it('matches the title case-insensitively when no type is supplied', () => {
    expect(body('bonafide certificate', fields)).toContain('bona fide employee');
  });
});
