import { describe, it, expect } from 'vitest';
import {
  businessCategoryForType,
  describeCompanyUploadPolicy,
  slugToBusinessCategory,
  uploadModeForType,
} from '@/lib/platform/document/categories';

describe('document business categories', () => {
  it('maps nav slugs to BRD buckets', () => {
    expect(slugToBusinessCategory('recruitment')).toBe('RECRUITMENT');
    expect(slugToBusinessCategory('letters')).toBe('LETTERS_CERTIFICATES');
    expect(slugToBusinessCategory('unknown')).toBeNull();
  });

  it('maps seeded type codes onto buckets', () => {
    expect(businessCategoryForType('AADHAAR', 'EMPLOYEE', 'IDENTITY')).toBe('EMPLOYEE');
    expect(businessCategoryForType('OFFER_LETTER', 'CANDIDATE', 'EMPLOYMENT')).toBe('RECRUITMENT');
    expect(businessCategoryForType('FNF_STATEMENT', 'EMPLOYEE', 'EXIT')).toBe('PAYROLL');
    expect(businessCategoryForType('FORM16', 'EMPLOYEE', 'STATUTORY')).toBe('PAYROLL');
    expect(businessCategoryForType('BONAFIDE', 'EMPLOYEE', 'EMPLOYMENT')).toBe('LETTERS_CERTIFICATES');
    expect(businessCategoryForType('RESIGNATION_LETTER', 'EMPLOYEE', 'EXIT')).toBe('LIFECYCLE');
    expect(businessCategoryForType('HR_POLICY', 'COMPANY', 'COMPANY')).toBe('COMPLIANCE');
  });

  it('treats issued letters and payroll artefacts as HR-only uploads', () => {
    expect(uploadModeForType('AADHAAR')).toBe('EMPLOYEE_WITH_HR_VERIFICATION');
    expect(uploadModeForType('APPOINTMENT_LETTER')).toBe('HR_ONLY');
    expect(uploadModeForType('FORM16')).toBe('HR_ONLY');
  });
});

describe('company upload policy (BRD three modes)', () => {
  it('reports hybrid when both per-type modes are in use', () => {
    expect(describeCompanyUploadPolicy(['EMPLOYEE_WITH_HR_VERIFICATION', 'HR_ONLY']).mode).toBe('HYBRID');
  });

  it('reports HR-only when no type is employee-uploadable', () => {
    expect(describeCompanyUploadPolicy(['HR_ONLY', 'HR_ONLY']).mode).toBe('HR_ONLY');
  });

  it('reports employee-upload when every type is employee-uploadable', () => {
    expect(describeCompanyUploadPolicy(['EMPLOYEE_WITH_HR_VERIFICATION']).mode).toBe('EMPLOYEE_WITH_HR_VERIFICATION');
  });

  it('treats a company with no types as employee-upload rather than throwing', () => {
    expect(describeCompanyUploadPolicy([]).mode).toBe('EMPLOYEE_WITH_HR_VERIFICATION');
  });

  it('keeps payslips HR-only — an employee must never upload their own', () => {
    expect(uploadModeForType('PAYSLIP')).toBe('HR_ONLY');
  });
});
