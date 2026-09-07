import { describe, it, expect } from 'vitest';
import {
  kycSchema,
  emergencyContactSchema,
  experienceSchema,
  passportSchema,
} from '@/lib/validations/employee';

describe('kycSchema — PAN/Aadhaar', () => {
  it('accepts a valid PAN and Aadhaar', () => {
    const result = kycSchema.safeParse({ panNumber: 'ABCDE1234F', aadhaarNumber: '123456789012' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed PAN', () => {
    const result = kycSchema.safeParse({ panNumber: 'not-a-pan' });
    expect(result.success).toBe(false);
  });

  it('rejects an Aadhaar that is not exactly 12 digits', () => {
    expect(kycSchema.safeParse({ aadhaarNumber: '12345' }).success).toBe(false);
    expect(kycSchema.safeParse({ aadhaarNumber: '1234567890123' }).success).toBe(false);
  });

  it('accepts an empty string for PAN/Aadhaar — "leave the stored value unchanged"', () => {
    const result = kycSchema.safeParse({ panNumber: '', aadhaarNumber: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed IFSC code', () => {
    expect(kycSchema.safeParse({ ifscCode: 'BADCODE' }).success).toBe(false);
    expect(kycSchema.safeParse({ ifscCode: 'HDFC0001234' }).success).toBe(true);
  });
});

describe('emergencyContactSchema — mobile number', () => {
  it('accepts up to 10 digits', () => {
    expect(emergencyContactSchema.safeParse({ contactName: 'A', relationship: 'Spouse', mobile: '9876543210' }).success).toBe(true);
  });

  it('rejects more than 10 digits', () => {
    expect(emergencyContactSchema.safeParse({ contactName: 'A', relationship: 'Spouse', mobile: '98765432101' }).success).toBe(false);
  });

  it('requires contactName and relationship', () => {
    expect(emergencyContactSchema.safeParse({ contactName: '', relationship: '' }).success).toBe(false);
  });
});

describe('experienceSchema — date ordering', () => {
  it('accepts toDate on or after fromDate', () => {
    expect(
      experienceSchema.safeParse({ companyName: 'Acme', designation: 'Eng', fromDate: '2020-01-01', toDate: '2022-01-01' }).success
    ).toBe(true);
  });

  it('rejects toDate before fromDate', () => {
    expect(
      experienceSchema.safeParse({ companyName: 'Acme', designation: 'Eng', fromDate: '2022-01-01', toDate: '2020-01-01' }).success
    ).toBe(false);
  });

  it('allows an open-ended (current) experience with no toDate', () => {
    expect(experienceSchema.safeParse({ companyName: 'Acme', designation: 'Eng', fromDate: '2020-01-01' }).success).toBe(true);
  });
});

describe('passportSchema — date ordering', () => {
  it('rejects expiryDate on or before issueDate', () => {
    expect(passportSchema.safeParse({ issueDate: '2026-01-01', expiryDate: '2026-01-01' }).success).toBe(false);
    expect(passportSchema.safeParse({ issueDate: '2026-01-01', expiryDate: '2020-01-01' }).success).toBe(false);
  });

  it('accepts expiryDate after issueDate', () => {
    expect(passportSchema.safeParse({ issueDate: '2020-01-01', expiryDate: '2030-01-01' }).success).toBe(true);
  });
});
