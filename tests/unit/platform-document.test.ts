/**
 * Pure-rule tests for the Document service (no DB): magic bytes,
 * extension/size validation, identifier masking, FY/serial formatting,
 * state-machine table and completeness computation.
 */
import { describe, it, expect } from 'vitest';
import {
  DOC_STATUS,
  computeCompleteness,
  daysUntil,
  detectMagicType,
  extensionOf,
  financialYearCode,
  formatDocumentRef,
  isExtensionAllowed,
  isSizeWithinLimit,
  isTransitionAllowed,
  isValidPan,
  magicMatchesExtension,
  maskIdentifier,
  msUntilNextIstHour,
  parseAlertOffsets,
  sanitizeFileName,
  serialFromDocumentRef,
} from '@/lib/platform/document/rules';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1');

describe('platform-document rules: magic bytes', () => {
  it('detects pdf, jpg and png signatures', () => {
    expect(detectMagicType(PDF)).toBe('pdf');
    expect(detectMagicType(JPG)).toBe('jpg');
    expect(detectMagicType(PNG)).toBe('png');
    expect(detectMagicType(Buffer.from('hello world'))).toBeNull();
    expect(detectMagicType(Buffer.alloc(0))).toBeNull();
  });

  it('matches the signature against the declared extension (jpeg is an alias of jpg)', () => {
    expect(magicMatchesExtension(PNG, 'png')).toBe(true);
    expect(magicMatchesExtension(PNG, 'PNG')).toBe(true);
    expect(magicMatchesExtension(JPG, 'jpeg')).toBe(true);
    expect(magicMatchesExtension(PDF, 'pdf')).toBe(true);
    expect(magicMatchesExtension(PDF, 'png')).toBe(false);
    expect(magicMatchesExtension(PNG, 'pdf')).toBe(false);
    expect(magicMatchesExtension(PNG, 'exe')).toBe(false);
  });
});

describe('platform-document rules: extension and size', () => {
  it('extracts a lower-case extension and ignores directories', () => {
    expect(extensionOf('scan.PDF')).toBe('pdf');
    expect(extensionOf('C:\\docs\\photo.Jpg')).toBe('jpg');
    expect(extensionOf('noext')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
  });

  it('checks allowedFileTypes case-insensitively with jpg/jpeg aliasing', () => {
    expect(isExtensionAllowed('PDF', 'pdf, JPG ,png')).toBe(true);
    expect(isExtensionAllowed('jpeg', 'pdf,jpg,png')).toBe(true);
    expect(isExtensionAllowed('jpg', 'jpeg')).toBe(true);
    expect(isExtensionAllowed('gif', 'pdf,jpg,png')).toBe(false);
    expect(isExtensionAllowed('', 'pdf')).toBe(false);
  });

  it('enforces maxFileSizeMb and rejects empty files', () => {
    expect(isSizeWithinLimit(2 * 1024 * 1024, 2)).toBe(true);
    expect(isSizeWithinLimit(2 * 1024 * 1024 + 1, 2)).toBe(false);
    expect(isSizeWithinLimit(0, 5)).toBe(false);
    expect(isSizeWithinLimit(-1, 5)).toBe(false);
  });

  it('sanitises file names: strips paths and control characters, caps to 260', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a\u0000b\u001f.pdf')).toBe('ab.pdf');
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('x'.repeat(300) + '.pdf')).toHaveLength(260);
  });
});

describe('platform-document rules: identifiers', () => {
  it('masks everything but the last four characters and never returns the raw value', () => {
    expect(maskIdentifier('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskIdentifier('1234 5678 9012')).toBe('XXXXXXXX9012');
    expect(maskIdentifier('1234-5678-9012')).toBe('XXXXXXXX9012');
    expect(maskIdentifier('12')).toBe('12');
    expect(maskIdentifier('')).toBeNull();
    expect(maskIdentifier(null)).toBeNull();
    expect(maskIdentifier(undefined)).toBeNull();
  });

  it('validates PAN format with P as the fourth character', () => {
    expect(isValidPan('ABCPE1234F')).toBe(true);
    expect(isValidPan('abcpe1234f')).toBe(true);
    expect(isValidPan('ABCDE1234F')).toBe(false); // fourth char not P
    expect(isValidPan('ABCP1234F')).toBe(false);
    expect(isValidPan('ABCPE12345')).toBe(false);
  });
});

describe('platform-document rules: document reference', () => {
  it('computes the Indian financial year code', () => {
    expect(financialYearCode(new Date(Date.UTC(2025, 3, 1)))).toBe('2526'); // 1 Apr 2025
    expect(financialYearCode(new Date(Date.UTC(2026, 2, 31)))).toBe('2526'); // 31 Mar 2026
    expect(financialYearCode(new Date(Date.UTC(2026, 3, 1)))).toBe('2627'); // 1 Apr 2026
    expect(financialYearCode(new Date(Date.UTC(2099, 11, 31)))).toBe('9900');
  });

  it('formats and parses DOC/<FY>/<serial> with a six-digit zero-padded serial', () => {
    expect(formatDocumentRef('2526', 1)).toBe('DOC/2526/000001');
    expect(formatDocumentRef('2526', 123456)).toBe('DOC/2526/123456');
    expect(formatDocumentRef('2526', 1234567)).toBe('DOC/2526/1234567');
    expect(serialFromDocumentRef('DOC/2526/000042')).toBe(42);
    expect(serialFromDocumentRef('DOC/2526/1234567')).toBe(1234567);
    expect(serialFromDocumentRef(null)).toBe(0);
    expect(serialFromDocumentRef('garbage')).toBe(0);
  });
});

describe('platform-document rules: state machine table (§16.1)', () => {
  it('allows only the specified transitions', () => {
    expect(isTransitionAllowed(DOC_STATUS.Uploaded, DOC_STATUS.UnderVerification)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.Uploaded, DOC_STATUS.Withdrawn)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.UnderVerification, DOC_STATUS.Verified)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.UnderVerification, DOC_STATUS.Rejected)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.Rejected, DOC_STATUS.ReuploadRequired)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.Verified, DOC_STATUS.Revoked)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.Verified, DOC_STATUS.Expired)).toBe(true);
    expect(isTransitionAllowed(DOC_STATUS.Verified, DOC_STATUS.Superseded)).toBe(true);
    // not allowed
    expect(isTransitionAllowed(DOC_STATUS.Uploaded, DOC_STATUS.Verified)).toBe(false);
    expect(isTransitionAllowed(DOC_STATUS.Uploaded, DOC_STATUS.Rejected)).toBe(false);
    expect(isTransitionAllowed(DOC_STATUS.Verified, DOC_STATUS.Withdrawn)).toBe(false);
    expect(isTransitionAllowed(DOC_STATUS.Withdrawn, DOC_STATUS.Uploaded)).toBe(false);
    expect(isTransitionAllowed(DOC_STATUS.Revoked, DOC_STATUS.Verified)).toBe(false);
    expect(isTransitionAllowed('Bogus', DOC_STATUS.Verified)).toBe(false);
  });
});

describe('platform-document rules: dates and offsets', () => {
  it('computes whole days between UTC calendar dates', () => {
    const today = new Date(Date.UTC(2026, 8, 15));
    expect(daysUntil(new Date(Date.UTC(2026, 8, 22)), today)).toBe(7);
    expect(daysUntil(new Date(Date.UTC(2026, 8, 15)), today)).toBe(0);
    expect(daysUntil(new Date(Date.UTC(2026, 8, 14)), today)).toBe(-1);
  });

  it('parses alert offsets with the §15.1 default', () => {
    expect(parseAlertOffsets('90, 60,30,7,0')).toEqual([90, 60, 30, 7, 0]);
    expect(parseAlertOffsets(null)).toEqual([60, 30, 15, 7, 0]);
    expect(parseAlertOffsets('x,y')).toEqual([60, 30, 15, 7, 0]);
  });

  it('schedules the next 08:00 IST strictly in the future', () => {
    // 02:30 UTC == 08:00 IST → next run is tomorrow, 24h away
    const at0800 = new Date(Date.UTC(2026, 8, 15, 2, 30, 0));
    expect(msUntilNextIstHour(8, at0800)).toBe(24 * 3600 * 1000);
    // 01:30 UTC == 07:00 IST → one hour
    expect(msUntilNextIstHour(8, new Date(Date.UTC(2026, 8, 15, 1, 30, 0)))).toBe(3600 * 1000);
    // 03:30 UTC == 09:00 IST → 23 hours
    expect(msUntilNextIstHour(8, new Date(Date.UTC(2026, 8, 15, 3, 30, 0)))).toBe(23 * 3600 * 1000);
  });
});

describe('platform-document rules: completeness (§16.4)', () => {
  const types = [
    { code: 'PAN', appliesToEntity: 'EMPLOYEE', mandatoryFlag: true, mandatoryFromStage: null, isActive: true },
    { code: 'PHOTO', appliesToEntity: 'EMPLOYEE', mandatoryFlag: true, mandatoryFromStage: 'JOINING', isActive: true },
    { code: 'MEDICAL_FITNESS', appliesToEntity: 'EMPLOYEE', mandatoryFlag: true, mandatoryFromStage: 'CONFIRMATION', isActive: true },
    { code: 'SKILL_CERT', appliesToEntity: 'EMPLOYEE', mandatoryFlag: false, mandatoryFromStage: null, isActive: true },
    { code: 'OLD_TYPE', appliesToEntity: 'EMPLOYEE', mandatoryFlag: true, mandatoryFromStage: null, isActive: false },
    { code: 'SSLC', appliesToEntity: 'CANDIDATE', mandatoryFlag: true, mandatoryFromStage: null, isActive: true },
  ];

  it('reports missing, pending and expired mandatory types', () => {
    const docs = [
      { documentTypeCode: 'PAN', verificationStatus: 'Verified' },
      { documentTypeCode: 'PHOTO', verificationStatus: 'Uploaded' },
      { documentTypeCode: 'MEDICAL_FITNESS', verificationStatus: 'Expired' },
      { documentTypeCode: 'SKILL_CERT', verificationStatus: 'Verified' },
    ];
    const r = computeCompleteness(types, docs, 'EMPLOYEE');
    expect(r).toEqual({ complete: false, missing: [], pending: ['PHOTO'], expired: ['MEDICAL_FITNESS'] });
  });

  it('is complete when every mandatory type has a Verified document; superseded/rejected do not count', () => {
    const docs = [
      { documentTypeCode: 'PAN', verificationStatus: 'Superseded' },
      { documentTypeCode: 'PAN', verificationStatus: 'Verified' },
      { documentTypeCode: 'PHOTO', verificationStatus: 'ReuploadRequired' },
      { documentTypeCode: 'PHOTO', verificationStatus: 'Verified' },
      { documentTypeCode: 'MEDICAL_FITNESS', verificationStatus: 'Verified' },
    ];
    expect(computeCompleteness(types, docs, 'EMPLOYEE')).toEqual({ complete: true, missing: [], pending: [], expired: [] });
  });

  it('filters by stage and ignores inactive types and other entity types', () => {
    const r = computeCompleteness(types, [], 'EMPLOYEE', 'JOINING');
    expect(r.missing).toEqual(['PAN', 'PHOTO']);
    expect(computeCompleteness(types, [], 'EMPLOYEE').missing).toEqual(['PAN', 'PHOTO', 'MEDICAL_FITNESS']);
    expect(computeCompleteness(types, [], 'CANDIDATE').missing).toEqual(['SSLC']);
  });
});
