/**
 * BRD Document Module buckets (nav) vs the technical PlatformDocumentType.category.
 * Keep mapping here so seed, search, and the hub UI stay in lockstep.
 */

export const DOCUMENT_BUSINESS_CATEGORIES = [
  'RECRUITMENT',
  'EMPLOYEE',
  'LETTERS_CERTIFICATES',
  'LIFECYCLE',
  'PAYROLL',
  'COMPLIANCE',
] as const;
export type DocumentBusinessCategory = (typeof DOCUMENT_BUSINESS_CATEGORIES)[number];

/**
 * Upload modes are per document type. The BRD also names a "Hybrid" mode —
 * employees upload selected documents while HR controls letters, payroll and
 * compliance files — but that is the *company-level effect* of mixing these
 * two per-type values, not a third setting a single type could carry: one
 * document is either employee-uploadable or it is not. A company is therefore
 * in hybrid mode whenever its active types use both values; see
 * describeCompanyUploadPolicy().
 */
export const DOCUMENT_UPLOAD_MODES = ['EMPLOYEE_WITH_HR_VERIFICATION', 'HR_ONLY'] as const;
export type DocumentUploadMode = (typeof DOCUMENT_UPLOAD_MODES)[number];

export const BUSINESS_CATEGORY_SLUGS = {
  recruitment: 'RECRUITMENT',
  employee: 'EMPLOYEE',
  letters: 'LETTERS_CERTIFICATES',
  lifecycle: 'LIFECYCLE',
  payroll: 'PAYROLL',
  compliance: 'COMPLIANCE',
} as const;
export type BusinessCategorySlug = keyof typeof BUSINESS_CATEGORY_SLUGS;

export const BUSINESS_CATEGORY_LABELS: Record<DocumentBusinessCategory, string> = {
  RECRUITMENT: 'Recruitment Documents',
  EMPLOYEE: 'Employee Documents',
  LETTERS_CERTIFICATES: 'Letters & Certificates',
  LIFECYCLE: 'Lifecycle Documents',
  PAYROLL: 'Payroll Documents',
  COMPLIANCE: 'Compliance Documents',
};

export const SLUG_BY_BUSINESS_CATEGORY: Record<DocumentBusinessCategory, BusinessCategorySlug> = {
  RECRUITMENT: 'recruitment',
  EMPLOYEE: 'employee',
  LETTERS_CERTIFICATES: 'letters',
  LIFECYCLE: 'lifecycle',
  PAYROLL: 'payroll',
  COMPLIANCE: 'compliance',
};

/** Types HR issues; employees cannot upload these. */
export const HR_ONLY_TYPE_CODES: ReadonlySet<string> = new Set([
  'OFFER_LETTER',
  'APPOINTMENT_LETTER',
  'FNF_STATEMENT',
  'FORM16',
  'PAYSLIP',
  'HR_POLICY',
  'CONTRACT_AGREEMENT',
  'TRAINING_MATERIAL',
  'SERVICE_LETTER',
  'BONAFIDE',
  'WARNING_LETTER',
  'SHOW_CAUSE',
  'COMPANY_RELIEVING',
  'CONFIRMATION_LETTER',
]);

const TYPE_BUSINESS_CATEGORY: Record<string, DocumentBusinessCategory> = {
  SSLC: 'RECRUITMENT',
  HSC: 'RECRUITMENT',
  DEGREE_CERT: 'RECRUITMENT',
  EXPERIENCE_CERT: 'RECRUITMENT',
  RELIEVING_LETTER: 'RECRUITMENT',
  PAYSLIP_PREV: 'RECRUITMENT',
  OFFER_LETTER: 'RECRUITMENT',
  APPOINTMENT_LETTER: 'RECRUITMENT',
  MEDICAL_FITNESS: 'RECRUITMENT',
  CANDIDATE_AADHAAR: 'RECRUITMENT',
  CANDIDATE_PAN: 'RECRUITMENT',
  RESUME: 'RECRUITMENT',
  CANDIDATE_PHOTO: 'RECRUITMENT',
  AADHAAR: 'EMPLOYEE',
  PAN: 'EMPLOYEE',
  BANK_PROOF: 'EMPLOYEE',
  PHOTO: 'EMPLOYEE',
  ADDRESS_PROOF: 'EMPLOYEE',
  SERVICE_LETTER: 'LETTERS_CERTIFICATES',
  BONAFIDE: 'LETTERS_CERTIFICATES',
  WARNING_LETTER: 'LETTERS_CERTIFICATES',
  SHOW_CAUSE: 'LETTERS_CERTIFICATES',
  COMPANY_RELIEVING: 'LETTERS_CERTIFICATES',
  SAFETY_INDUCTION: 'LIFECYCLE',
  SKILL_CERT: 'LIFECYCLE',
  TRAINING_MATERIAL: 'LIFECYCLE',
  TRAINING_CERT: 'LIFECYCLE',
  EXIT_CLEARANCE: 'LIFECYCLE',
  RESIGNATION_LETTER: 'LIFECYCLE',
  ASSET_HANDOVER: 'LIFECYCLE',
  CONFIRMATION_LETTER: 'LIFECYCLE',
  FNF_STATEMENT: 'PAYROLL',
  FORM16: 'PAYROLL',
  PAYSLIP: 'PAYROLL',
  CONTRACT_AGREEMENT: 'COMPLIANCE',
  HR_POLICY: 'COMPLIANCE',
};

export function isBusinessCategory(value: string): value is DocumentBusinessCategory {
  return (DOCUMENT_BUSINESS_CATEGORIES as readonly string[]).includes(value);
}

export function isUploadMode(value: string): value is DocumentUploadMode {
  return (DOCUMENT_UPLOAD_MODES as readonly string[]).includes(value);
}

export function slugToBusinessCategory(slug: string): DocumentBusinessCategory | null {
  const key = slug.toLowerCase() as BusinessCategorySlug;
  return BUSINESS_CATEGORY_SLUGS[key] ?? null;
}

export function businessCategoryForType(
  code: string,
  appliesToEntity: string,
  technicalCategory: string,
): DocumentBusinessCategory {
  const mapped = TYPE_BUSINESS_CATEGORY[code.toUpperCase()];
  if (mapped) return mapped;
  if (appliesToEntity === 'CANDIDATE') return 'RECRUITMENT';
  if (technicalCategory === 'EXIT') return 'LIFECYCLE';
  if (technicalCategory === 'STATUTORY' || technicalCategory === 'COMPANY') return 'COMPLIANCE';
  if (technicalCategory === 'FINANCIAL') return 'PAYROLL';
  return 'EMPLOYEE';
}

export function uploadModeForType(code: string): DocumentUploadMode {
  return HR_ONLY_TYPE_CODES.has(code.toUpperCase()) ? 'HR_ONLY' : 'EMPLOYEE_WITH_HR_VERIFICATION';
}

/**
 * Which of the BRD's three upload modes a company is effectively running,
 * derived from the mix of its active document types.
 */
export function describeCompanyUploadPolicy(
  modes: readonly string[],
): { mode: 'EMPLOYEE_WITH_HR_VERIFICATION' | 'HR_ONLY' | 'HYBRID'; label: string } {
  const hasEmployee = modes.includes('EMPLOYEE_WITH_HR_VERIFICATION');
  const hasHrOnly = modes.includes('HR_ONLY');
  if (hasEmployee && hasHrOnly) {
    return { mode: 'HYBRID', label: 'Hybrid — employees upload some types, HR controls the rest' };
  }
  if (hasHrOnly) return { mode: 'HR_ONLY', label: 'HR upload only — employees cannot upload any type' };
  return {
    mode: 'EMPLOYEE_WITH_HR_VERIFICATION',
    label: 'Employee upload with HR verification — every type is employee-uploadable',
  };
}
