/**
 * Segment-wise Excel import for Employees — one sheet per Employee-page tab
 * (Basic, Job Profile, Personal & Contact, CTC, Salary, Education,
 * Experience, Passport, Dependents, Emergency Contacts, Benefits, Assets,
 * Skills, KYC & Statutory), joined by an "Employee Code" column present on
 * every sheet. See docs/EMPLOYEE_EXCEL_IMPORT_PLAN_2026-09-18.md for the
 * agreed design. Activity is system-generated and out of scope.
 *
 * Mandatory sheets: Basic, Job Profile, CTC, Salary, KYC & Statutory. An
 * employee missing a row on any of these is rejected as a whole
 * (validateBatch). Everyone else still imports.
 *
 * Repeatable sheets (Education, Experience, Dependents, Emergency Contacts,
 * Benefits, Assets, Skills) take zero or more rows per employee. A bad row
 * on one of these never blocks the employee — it's skipped and reported on
 * its own, the rest of that employee still imports.
 *
 * New employees don't have a real code yet: HR writes a temporary code
 * (e.g. NEW-001) on every sheet for that person. The import page resolves it
 * to the system-generated employeeCode once Basic is created and keeps using
 * it as the report's display key throughout.
 *
 * Existing employees use their real Employee Code (or Device ID) — the
 * Basic sheet row then *updates* rather than creates.
 */

import * as XLSX from 'xlsx';
import type { OptionList, EmployeeRef } from '@/lib/employee-form-fields';

export interface BulkImportMasters {
  companies: OptionList;
  units: OptionList;
  departments: OptionList;
  subDepartments: OptionList;
  designations: OptionList;
  employeeTypes: OptionList;
  categories: OptionList;
  grades: OptionList;
  levels: OptionList;
  salaryComponents: OptionList; // active, company-scoped
  assetMasters: OptionList;
  benefitRates: OptionList; // { id, code, name }
  reportingManagers: EmployeeRef[];
}

const CODE_COL = 'Employee Code (temp code like NEW-001 for a new joiner)';

// ── shared cell helpers ─────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function num(v: unknown): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean {
  const s = str(v).toLowerCase();
  return s === 'yes' || s === 'true' || s === '1';
}

/** Excel may hand back a JS Date (if the cell was date-formatted) or a plain string. */
function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function byName(list: OptionList, name: string): number | undefined {
  const target = name.trim().toLowerCase();
  return list.find((o) => o.name.trim().toLowerCase() === target)?.id;
}

function byCode(list: OptionList, code: string): number | undefined {
  const target = code.trim().toLowerCase();
  return list.find((o) => 'code' in o && String((o as unknown as { code: string }).code).trim().toLowerCase() === target)?.id;
}

// ─── Basic (identity + current JobInfo classification) sheet ───────────────

export const BASIC_COLUMNS = [
  CODE_COL,
  'Device ID (Biometric)',
  'Title',
  'First Name',
  'Middle Name',
  'Last Name',
  'Company',
  'Unit / Branch',
  'Department',
  'Sub Department',
  'Designation',
  'Employee Type',
  'Category',
  'Subcategory',
  'Grade',
  'Level',
  'Join Date (YYYY-MM-DD)',
  'Probation Period (Months)',
  'Confirmation Date (YYYY-MM-DD, leave blank if still on probation)',
  'Reporting Manager Employee Code',
  'Shift Assignment Type (GENERAL/ROTATIONAL)',
  'Production Line',
  'Additional Role',
  'Team Group',
] as const;
type BasicColumn = (typeof BASIC_COLUMNS)[number];

const BASIC_EXAMPLE_ROW = [
  'NEW-001', '105', 'Mr', 'Ravi', '', 'Kumar', 'KUN Aerospace Private Limited', 'Main Unit',
  'Production', '', 'Machine Operator', 'Permanent', 'Workmen', '', '', '',
  '2025-01-15', '6', '', '', 'GENERAL', '', '', '',
];

// ─── Job Profile sheet ───────────────────────────────────────────────────────

export const JOB_PROFILE_COLUMNS = [
  CODE_COL,
  'Wage Type',
  'Payment Mode',
  'Official Email',
  'Petrol Allowance (Yes/No)',
  'PF Applicable (Yes/No)',
  'ESI Applicable (Yes/No)',
  'Professional Tax Applicable (Yes/No)',
  'Bonus Applicable (Yes/No)',
  'LTA Eligible (Yes/No)',
  'PF Restriction Amount',
  'Overtime Allowed (Yes/No)',
  'Overtime Factor',
  'Overtime Rate Per Hour',
  'Loss of Minutes Deduction Applicable (Yes/No)',
  'Allowed Loss of Minutes',
  'Number of Leaves Allowed',
  'Permission Request Allowed (Yes/No)',
  'Permission Hours',
] as const;
type JobProfileColumn = (typeof JOB_PROFILE_COLUMNS)[number];

const JOB_PROFILE_EXAMPLE_ROW = ['NEW-001', 'Monthly', 'Bank Transfer', '', 'No', 'Yes', 'No', 'No', 'No', 'No', '', 'No', '', '', 'No', '', '', 'No', ''];

// ─── Personal & Contact sheet ────────────────────────────────────────────────

export const PERSONAL_COLUMNS = [
  CODE_COL,
  'Date of Birth (YYYY-MM-DD)',
  'Gender',
  'Blood Group',
  'Marital Status',
  'Marriage Date (YYYY-MM-DD)',
  'Number of Children',
  'Nationality',
  'Religion',
  'Personal Category',
  'Physically Challenged (Yes/No)',
  'Physically Challenged Category',
  'International Worker (Yes/No)',
  'Height (cm)',
  'Weight (kg)',
  'Shirt Size',
  'Pant Size',
  'Permanent Address Line 1',
  'Permanent Address Line 2',
  'Permanent City',
  'Permanent State',
  'Permanent Pincode',
  'Permanent Mobile',
  'Same As Permanent (Yes/No)',
  'Present Address Line 1',
  'Present Address Line 2',
  'Present City',
  'Present State',
  'Present Pincode',
  'Present Mobile',
] as const;
type PersonalColumn = (typeof PERSONAL_COLUMNS)[number];

const PERSONAL_EXAMPLE_ROW = [
  'NEW-001', '1995-06-20', 'Male', 'O+', 'Single', '', '', 'Indian', '', '', 'No', '', 'No', '', '', '', '',
  '12 Main Street', '', 'Chennai', 'Tamil Nadu', '600001', '9840000000', 'Yes', '', '', '', '', '', '',
];

// ─── CTC sheet ──────────────────────────────────────────────────────────────

export const CTC_COLUMNS = [
  CODE_COL,
  'Effective From (YYYY-MM-DD)',
  'Basic',
  'HRA',
  'Special Allowance',
  'Conveyance Allowance',
  'Wash Allowance',
  'Canteen',
  'Dislocation Allowance',
  'Other Allowance',
  'Shift Allowance',
  'Attendance Bonus',
  'Bonus',
  'LTA',
  'Medical Claim',
  'Employee PF',
  'Employee ESI',
  'Employer PF',
  'Employer ESI',
  'Gratuity',
  'Other Benefits',
  'Non-Monetary Benefits',
  'Monthly CTC',
  'Annual CTC',
] as const;
type CtcColumn = (typeof CTC_COLUMNS)[number];

const CTC_REQUIRED: CtcColumn[] = [CODE_COL, 'Effective From (YYYY-MM-DD)', 'Basic', 'Monthly CTC', 'Annual CTC'];

const CTC_EXAMPLE_ROW = [
  'NEW-001', '2025-01-15', '15000', '6000', '2000', '1000', '', '', '', '', '', '', '', '', '', '900', '', '1800', '', '', '', '', '25700', '308400',
];

// ─── Salary (component) sheet — component columns are generated per company ─

export const SALARY_FIXED_COLUMNS = [CODE_COL, 'Effective From (YYYY-MM-DD)', 'Financial Year (e.g. 2025-26)'] as const;

// ─── Education sheet (repeatable) ───────────────────────────────────────────

export const EDUCATION_COLUMNS = [CODE_COL, 'Qualification', 'Institution', 'University', 'Year of Passing', 'Percentage'] as const;
type EducationColumn = (typeof EDUCATION_COLUMNS)[number];
const EDUCATION_EXAMPLE_ROW = ['NEW-001', 'B.Tech', 'ABC Engineering College', 'Anna University', '2016', '72'];

// ─── Experience sheet (repeatable) ──────────────────────────────────────────

export const EXPERIENCE_COLUMNS = [
  CODE_COL, 'Company Name', 'Previous Designation', 'From Date (YYYY-MM-DD)', 'To Date (YYYY-MM-DD)', 'Reason for Leaving', 'Last Drawn Salary',
] as const;
type ExperienceColumn = (typeof EXPERIENCE_COLUMNS)[number];
const EXPERIENCE_EXAMPLE_ROW = ['NEW-001', 'Previous Co Pvt Ltd', 'Operator', '2020-01-01', '2024-12-31', 'Better opportunity', '18000'];

// ─── Passport sheet ──────────────────────────────────────────────────────────

export const PASSPORT_COLUMNS = [
  CODE_COL, 'Passport Number', 'Place of Issue', 'Country of Issue', 'Issue Date (YYYY-MM-DD)', 'Expiry Date (YYYY-MM-DD)', 'Verification Status',
] as const;
type PassportColumn = (typeof PASSPORT_COLUMNS)[number];
const PASSPORT_EXAMPLE_ROW = ['NEW-001', '', '', '', '', '', ''];

// ─── Dependents sheet (repeatable) ──────────────────────────────────────────

export const DEPENDENTS_COLUMNS = [CODE_COL, 'Dependent Name', 'Relationship', 'Date of Birth (YYYY-MM-DD)', 'Is Dependent (Yes/No)'] as const;
type DependentColumn = (typeof DEPENDENTS_COLUMNS)[number];
const DEPENDENTS_EXAMPLE_ROW = ['NEW-001', 'Priya Kumar', 'Spouse', '1997-03-10', 'Yes'];

// ─── Emergency Contacts sheet (repeatable) ──────────────────────────────────

export const EMERGENCY_CONTACTS_COLUMNS = [
  CODE_COL, 'Contact Name', 'Relationship', 'Address', 'Home Phone', 'Mobile', 'Alternate Phone', 'Email', 'Is Primary (Yes/No)', 'Remarks',
] as const;
type EmergencyContactColumn = (typeof EMERGENCY_CONTACTS_COLUMNS)[number];
const EMERGENCY_CONTACTS_EXAMPLE_ROW = ['NEW-001', 'Suresh Kumar', 'Father', '', '', '9840000001', '', '', 'Yes', ''];

// ─── Benefits sheet (repeatable — one row per benefit rate assigned) ───────

export const BENEFITS_COLUMNS = [CODE_COL, 'Benefit Rate Code (see Reference Lists)'] as const;
type BenefitsColumn = (typeof BENEFITS_COLUMNS)[number];
const BENEFITS_EXAMPLE_ROW = ['NEW-001', ''];

// ─── Assets sheet (repeatable) ──────────────────────────────────────────────

export const ASSETS_COLUMNS = [
  CODE_COL, 'Asset Type (see Reference Lists)', 'Serial Number', 'Model', 'Asset Value', 'Issue Date (YYYY-MM-DD)', 'Expected Return Date (YYYY-MM-DD)', 'Notes',
] as const;
type AssetColumn = (typeof ASSETS_COLUMNS)[number];
const ASSETS_EXAMPLE_ROW = ['NEW-001', '', '', '', '', '', '', ''];

// ─── Skills sheet (repeatable) ──────────────────────────────────────────────

export const SKILLS_COLUMNS = [
  CODE_COL, 'Skill Category', 'Skill / Machine / Operation', 'Proficiency Level', 'Level %', 'Certified (Yes/No)', 'Certificate Number',
  'Certified Date (YYYY-MM-DD)', 'Expiry Date (YYYY-MM-DD)', 'Evaluated By', 'Remarks',
] as const;
type SkillColumn = (typeof SKILLS_COLUMNS)[number];
const SKILLS_EXAMPLE_ROW = ['NEW-001', '', '', '', '', 'No', '', '', '', '', ''];

// ─── KYC & Statutory sheet ──────────────────────────────────────────────────

export const KYC_COLUMNS = [
  CODE_COL,
  'PAN Number',
  'Aadhaar Number',
  'Bank Name',
  'Branch Name',
  'Bank Account Number',
  'IFSC Code',
  'Account Type (savings/current)',
  'UAN Number',
  'ESI Number',
  'PF Number',
] as const;
type KycColumn = (typeof KYC_COLUMNS)[number];

const KYC_REQUIRED: KycColumn[] = [CODE_COL, 'PAN Number', 'Aadhaar Number', 'Bank Account Number', 'IFSC Code'];

const KYC_EXAMPLE_ROW = ['NEW-001', 'ABCDE1234F', '123456789012', 'State Bank of India', 'Main Branch', '00000012345678', 'SBIN0001234', 'savings', '', '', ''];

export const MANDATORY_SHEETS = ['Basic', 'Job Profile', 'CTC', 'Salary', 'KYC & Statutory'] as const;

// ─── Template workbook ──────────────────────────────────────────────────────

function refSheetColumn<T>(label: string, list: T[], toLabel: (x: T) => string) {
  return [label, ...list.map(toLabel)];
}

function sheetFrom(header: readonly string[], example: readonly (string | number)[]) {
  const s = XLSX.utils.aoa_to_sheet([[...header], [...example]]);
  s['!cols'] = header.map(() => ({ wch: 22 }));
  return s;
}

/**
 * "Read Me First" — the in-workbook manual. It ships as the first sheet so
 * it travels with the file however it's opened, forwarded or re-saved, and
 * doesn't depend on HR still being on the Bulk Upload page when they fill
 * it in. Mirrors the on-page instructions panel; keep the two in sync.
 */
const READ_ME_STEPS: (string | number)[][] = [
  ['STEP', 'WHAT TO DO'],
  [1, 'Start with the Basic sheet — every other sheet is matched to it by the Employee Code column.'],
  [2, 'Hiring someone new? Invent a short temporary code for them, e.g. NEW-001, NEW-002 — and use that exact same code on every sheet you fill in for that person.'],
  [3, 'Updating someone already in the system? Use their real Employee Code (or Device ID) from the Employee Master export — not a temporary code.'],
  [4, 'Basic, Job Profile, CTC, Salary and KYC & Statutory are mandatory. Every employee needs one row on each of these five sheets, or they will not be imported.'],
  [5, 'Personal & Contact, Education, Experience, Passport, Dependents, Emergency Contacts, Benefits, Assets and Skills are optional — leave a sheet blank for someone if it does not apply.'],
  [6, 'Education, Experience, Dependents, Emergency Contacts, Benefits, Assets and Skills can each have more than one row per employee — add as many rows as needed, repeating the same Employee Code on each.'],
  [7, 'For Company / Department / Designation / Employee Type / Category / Grade / Level / Asset Type, type the name exactly as it appears on the Reference Lists sheet — copy-paste from there is safest.'],
  [8, 'Dates go in YYYY-MM-DD (e.g. 2025-01-15). Yes/No columns take the word "Yes" or "No".'],
  [9, 'Save the file, then upload it on the Bulk Upload Employees page. Nothing is saved to the system yet — you get a report first, sheet by sheet, per employee.'],
  [10, 'Employees marked "Blocked" have not been imported. Click Download Error File — it is this same template with only the blocked/failed people, showing exactly what to fix. Fix those cells and upload it again.'],
  [11, 'Employees marked "Ready" or already "Imported" are unaffected by a re-upload of the error file — only the people still needing fixes are in it.'],
  [12, ''],
  ['', 'Sheet-by-sheet reference:'],
  ['SHEET', 'MANDATORY?', 'ROWS PER EMPLOYEE', 'WHAT IT COVERS'],
  ['Basic', 'Yes', 'One', 'Name, company, department, designation, join date, reporting manager, probation/confirmation'],
  ['Job Profile', 'Yes', 'One', 'Wage type, payment mode, PF/ESI/bonus/LTA flags, overtime rules, leave allowance'],
  ['Personal & Contact', 'No', 'One', 'Date of birth, gender, marital status, permanent and present address'],
  ['CTC', 'Yes', 'One', 'Fixed CTC breakup — Basic, HRA, allowances, Monthly/Annual CTC'],
  ['Salary', 'Yes', 'One', 'Component-wise salary used by payroll — one column per active salary component'],
  ['Education', 'No', 'Many', 'Qualifications — one row per qualification'],
  ['Experience', 'No', 'Many', 'Previous employment — one row per past employer'],
  ['Passport', 'No', 'One', 'Passport number and validity, if applicable'],
  ['Dependents', 'No', 'Many', 'Family members marked as dependents — one row per person'],
  ['Emergency Contacts', 'No', 'Many', 'Who to contact in an emergency — one row per contact'],
  ['Benefits', 'No', 'Many', 'Benefit rates assigned to this employee — one row per benefit, by its code'],
  ['Assets', 'No', 'Many', 'Company assets issued to this employee — one row per asset'],
  ['Skills', 'No', 'Many', 'Skill / machine / operation proficiency — one row per skill'],
  ['KYC & Statutory', 'Yes', 'One', 'PAN, Aadhaar, bank account, IFSC — required for payroll'],
];

function buildReadMeSheet(): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(READ_ME_STEPS);
  sheet['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 70 }];
  return sheet;
}

export function buildTemplateWorkbook(masters: BulkImportMasters): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildReadMeSheet(), 'Read Me First');
  XLSX.utils.book_append_sheet(wb, sheetFrom(BASIC_COLUMNS, BASIC_EXAMPLE_ROW), 'Basic');
  XLSX.utils.book_append_sheet(wb, sheetFrom(JOB_PROFILE_COLUMNS, JOB_PROFILE_EXAMPLE_ROW), 'Job Profile');
  XLSX.utils.book_append_sheet(wb, sheetFrom(PERSONAL_COLUMNS, PERSONAL_EXAMPLE_ROW), 'Personal & Contact');
  XLSX.utils.book_append_sheet(wb, sheetFrom(CTC_COLUMNS, CTC_EXAMPLE_ROW), 'CTC');

  const salaryColumns = [...SALARY_FIXED_COLUMNS, ...masters.salaryComponents.map((c) => c.name)];
  const salaryExample = [
    'NEW-001', '2025-01-15', '2025-26',
    ...masters.salaryComponents.map((c) => (c.name.toUpperCase().includes('BASIC') ? '15000' : '')),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFrom(salaryColumns, salaryExample), 'Salary');

  XLSX.utils.book_append_sheet(wb, sheetFrom(EDUCATION_COLUMNS, EDUCATION_EXAMPLE_ROW), 'Education');
  XLSX.utils.book_append_sheet(wb, sheetFrom(EXPERIENCE_COLUMNS, EXPERIENCE_EXAMPLE_ROW), 'Experience');
  XLSX.utils.book_append_sheet(wb, sheetFrom(PASSPORT_COLUMNS, PASSPORT_EXAMPLE_ROW), 'Passport');
  XLSX.utils.book_append_sheet(wb, sheetFrom(DEPENDENTS_COLUMNS, DEPENDENTS_EXAMPLE_ROW), 'Dependents');
  XLSX.utils.book_append_sheet(wb, sheetFrom(EMERGENCY_CONTACTS_COLUMNS, EMERGENCY_CONTACTS_EXAMPLE_ROW), 'Emergency Contacts');
  XLSX.utils.book_append_sheet(wb, sheetFrom(BENEFITS_COLUMNS, BENEFITS_EXAMPLE_ROW), 'Benefits');
  XLSX.utils.book_append_sheet(wb, sheetFrom(ASSETS_COLUMNS, ASSETS_EXAMPLE_ROW), 'Assets');
  XLSX.utils.book_append_sheet(wb, sheetFrom(SKILLS_COLUMNS, SKILLS_EXAMPLE_ROW), 'Skills');
  XLSX.utils.book_append_sheet(wb, sheetFrom(KYC_COLUMNS, KYC_EXAMPLE_ROW), 'KYC & Statutory');

  const columns = [
    refSheetColumn('Company', masters.companies, (o) => o.name),
    refSheetColumn('Unit / Branch', masters.units, (o) => o.name),
    refSheetColumn('Department', masters.departments, (o) => o.name),
    refSheetColumn('Sub Department', masters.subDepartments, (o) => o.name),
    refSheetColumn('Designation', masters.designations, (o) => o.name),
    refSheetColumn('Employee Type', masters.employeeTypes, (o) => o.name),
    refSheetColumn('Category', masters.categories, (o) => o.name),
    refSheetColumn('Grade', masters.grades, (o) => o.name),
    refSheetColumn('Level', masters.levels, (o) => o.name),
    refSheetColumn('Salary Component (Salary sheet column names)', masters.salaryComponents, (o) => o.name),
    refSheetColumn('Asset Type', masters.assetMasters, (o) => o.name),
    refSheetColumn('Benefit Rate Code', masters.benefitRates, (o: OptionList[number]) => `${(o as unknown as { code: string }).code} — ${o.name}`),
    refSheetColumn(
      'Reporting Manager (Employee Code)',
      masters.reportingManagers,
      (e: EmployeeRef) => e.oldEmployeeCode ? `${e.oldEmployeeCode} — ${e.firstName} ${e.lastName}` : `${e.firstName} ${e.lastName}`
    ),
  ];
  const maxRows = Math.max(...columns.map((c) => c.length));
  const refRows: string[][] = [];
  for (let r = 0; r < maxRows; r++) {
    refRows.push(columns.map((c) => c[r] ?? ''));
  }
  const refSheet = XLSX.utils.aoa_to_sheet(refRows);
  refSheet['!cols'] = columns.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(wb, refSheet, 'Reference Lists');

  return wb;
}

// ─── Payload shapes each section API accepts ────────────────────────────────

export interface BasicPayload {
  companyId: number;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  oldEmployeeCode?: string;
  status: 'active';
  reportingManagerId?: number;
  departmentId: number;
  subDepartmentId?: number;
  designationId: number;
  employeeTypeId: number;
  categoryId?: number;
  subCategory?: string;
  gradeId?: number;
  levelId?: number;
  unitId?: number;
  productionLine?: string;
  additionalRole?: string;
  teamGroup?: string;
  joinDate: string;
  probationPeriodMonths?: number;
  shiftAssignmentType?: string;
}

export interface JobProfilePayload {
  wageType?: string;
  paymentMode?: string;
  officialEmail?: string;
  petrolAllowance: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  professionalTaxApplicable: boolean;
  bonusApplicable: boolean;
  ltaEligible: boolean;
  pfRestrictionAmount?: number;
  overtimeAllowed: boolean;
  overtimeFactor?: number;
  overtimeRatePerHour?: number;
  lossOfMinutesDeductionApplicable: boolean;
  allowedLossOfMinutes?: number;
  numberOfLeavesAllowed?: number;
  permissionRequestAllowed: boolean;
  permissionHours?: number;
}

export interface PersonalPayload {
  personal: {
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    maritalStatus?: string;
    marriageDate?: string;
    numberOfChildren?: number;
    nationality?: string;
    religion?: string;
    category?: string;
    physicallyChallenged: boolean;
    physicallyChallengedCategory?: string;
    internationalWorker: boolean;
    heightCm?: number;
    weightKg?: number;
    shirtSize?: string;
    pantSize?: string;
  };
  contact: {
    permanentAddressLine1?: string;
    permanentAddressLine2?: string;
    permanentCity?: string;
    permanentState?: string;
    permanentPincode?: string;
    permanentMobile?: string;
    sameAsPermanent: boolean;
    presentAddressLine1?: string;
    presentAddressLine2?: string;
    presentCity?: string;
    presentState?: string;
    presentPincode?: string;
    presentMobile?: string;
  };
}

export interface CtcPayload {
  effectiveFrom: string;
  basic: number;
  hra: number;
  specialAllowance: number;
  conveyanceAllowance: number;
  washAllowance: number;
  canteen: number;
  dislocationAllowance: number;
  otherAllowance: number;
  shiftAllowance: number;
  attendanceBonus: number;
  bonus: number;
  lta: number;
  medicalClaim: number;
  employeePf: number;
  employeeEsi: number;
  employerPf: number;
  employerEsi: number;
  gratuity: number;
  otherBenefits: number;
  nonMonetaryBenefits: number;
  monthlyCtc: number;
  annualCtc: number;
}

export interface SalaryPayload {
  effectiveFrom: string;
  financialYear?: string;
  grossSalary: number;
  components: { salaryComponentId: number; amount: number }[];
}

export interface EducationPayload {
  qualification: string;
  institution?: string;
  university?: string;
  yearOfPassing?: number;
  percentage?: number;
}

export interface ExperiencePayload {
  companyName: string;
  designation: string;
  fromDate: string;
  toDate?: string;
  reasonForLeaving?: string;
  lastDrawnSalary?: number;
}

export interface PassportPayload {
  passportNumber?: string;
  placeOfIssue?: string;
  countryOfIssue?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus?: string;
}

export interface DependentPayload {
  name: string;
  relationship: string;
  dateOfBirth?: string;
  isDependent: boolean;
}

export interface EmergencyContactPayload {
  contactName: string;
  relationship: string;
  address?: string;
  homePhone?: string;
  mobile?: string;
  alternatePhone?: string;
  email?: string;
  isPrimary: boolean;
  remarks?: string;
}

export interface BenefitRow {
  benefitRateId: number;
}

export interface AssetPayload {
  assetMasterId: number;
  serialNumber?: string;
  model?: string;
  assetValue?: number;
  allocatedDate: string;
  expectedReturnDate?: string;
  notes?: string;
}

export interface SkillPayload {
  skillCategory?: string;
  skillName: string;
  proficiencyLevel?: string;
  levelPercentage?: number;
  certified: boolean;
  certificateNumber?: string;
  certifiedDate?: string;
  expiryDate?: string;
  evaluatedBy?: string;
  remarks?: string;
}

export interface KycPayload {
  panNumber: string;
  aadhaarNumber: string;
  bankName?: string;
  branchName?: string;
  accountNumber: string;
  ifscCode: string;
  accountType?: string;
  uanNumber?: string;
  esiNumber?: string;
  pfNumber?: string;
}

// ─── Per-employee grouped result ────────────────────────────────────────────

export interface SheetOutcome<T> {
  present: boolean;
  payload?: T;
  errors: string[];
}

export interface RepeatableOutcome<T> {
  row: number; // source row number in that sheet, for error reporting
  payload?: T;
  errors: string[];
}

export interface EmployeeImportRow {
  code: string; // the code/temp-code that joins the sheets, as typed by HR
  displayName: string;
  isNewEmployee: boolean; // code not found among existing employees

  // mandatory, single row
  basic: SheetOutcome<BasicPayload>;
  jobProfile: SheetOutcome<JobProfilePayload>;
  ctc: SheetOutcome<CtcPayload>;
  salary: SheetOutcome<SalaryPayload>;
  kyc: SheetOutcome<KycPayload>;

  // optional, single row
  personal: SheetOutcome<PersonalPayload>;
  passport: SheetOutcome<PassportPayload>;

  // optional, repeatable
  education: RepeatableOutcome<EducationPayload>[];
  experience: RepeatableOutcome<ExperiencePayload>[];
  dependents: RepeatableOutcome<DependentPayload>[];
  emergencyContacts: RepeatableOutcome<EmergencyContactPayload>[];
  benefits: RepeatableOutcome<BenefitRow>[];
  assets: RepeatableOutcome<AssetPayload>[];
  skills: RepeatableOutcome<SkillPayload>[];

  /** Mandatory-sheet-presence + field errors on the mandatory sheets, computed by validateBatch(). */
  blocked: boolean;
  blockReasons: string[];
  /** Non-blocking: bad rows on optional/repeatable sheets, reported but skipped rather than blocking the employee. */
  warnings: string[];
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] | null {
  const sheet = wb.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

// ─── single-row section parsers ─────────────────────────────────────────────

function parseBasicRow(row: Record<string, unknown>, masters: BulkImportMasters): { payload?: BasicPayload; errors: string[] } {
  const get = (c: BasicColumn) => str(row[c]);
  const errors: string[] = [];

  const firstName = get('First Name');
  const lastName = get('Last Name');
  if (!firstName) errors.push('First Name is required');
  if (!lastName) errors.push('Last Name is required');

  const companyId = byName(masters.companies, get('Company'));
  if (!get('Company')) errors.push('Company is required');
  else if (!companyId) errors.push(`Company "${get('Company')}" not found`);

  const departmentId = byName(masters.departments, get('Department'));
  if (!get('Department')) errors.push('Department is required');
  else if (!departmentId) errors.push(`Department "${get('Department')}" not found`);

  const designationId = byName(masters.designations, get('Designation'));
  if (!get('Designation')) errors.push('Designation is required');
  else if (!designationId) errors.push(`Designation "${get('Designation')}" not found`);

  const employeeTypeId = byName(masters.employeeTypes, get('Employee Type'));
  if (!get('Employee Type')) errors.push('Employee Type is required');
  else if (!employeeTypeId) errors.push(`Employee Type "${get('Employee Type')}" not found`);

  const joinDate = toIsoDate(row['Join Date (YYYY-MM-DD)']);
  if (!joinDate) errors.push('Join Date is required (YYYY-MM-DD)');

  // "Confirmation Date" filled is only a signal here — the real
  // confirmationDate field can only be set by the Confirmation approval
  // workflow (POST /confirmation/approve, which itself requires a manager
  // recommendation first — not something an import can fabricate). Filled
  // means "hire this person straight into Confirmed", achieved by sending
  // no probation period so the create chain skips PROBATION on its own;
  // blank means "start on probation" and uses the given period as normal.
  const probationRaw = get('Probation Period (Months)');
  const alreadyConfirmed = Boolean(str(row['Confirmation Date (YYYY-MM-DD, leave blank if still on probation)']));
  if (!alreadyConfirmed && probationRaw && joinDate) {
    const months = Number(probationRaw);
    if (Number.isFinite(months) && months > 0) {
      const end = new Date(joinDate);
      end.setMonth(end.getMonth() + months);
      if (end.getTime() < Date.now()) {
        errors.push('Probation period has already lapsed — fill Confirmation Date to hire as already confirmed, or leave Probation Period blank');
      }
    }
  }

  const subDepartmentName = get('Sub Department');
  const unitName = get('Unit / Branch');
  const categoryName = get('Category');
  const gradeName = get('Grade');
  const levelName = get('Level');
  const mgrCode = get('Reporting Manager Employee Code');

  if (subDepartmentName && !byName(masters.subDepartments, subDepartmentName)) errors.push(`Sub Department "${subDepartmentName}" not found`);
  if (unitName && !byName(masters.units, unitName)) errors.push(`Unit / Branch "${unitName}" not found`);
  if (categoryName && !byName(masters.categories, categoryName)) errors.push(`Category "${categoryName}" not found`);
  if (gradeName && !byName(masters.grades, gradeName)) errors.push(`Grade "${gradeName}" not found`);
  if (levelName && !byName(masters.levels, levelName)) errors.push(`Level "${levelName}" not found`);

  let reportingManagerId: number | undefined;
  if (mgrCode) {
    reportingManagerId = masters.reportingManagers.find((e) => e.oldEmployeeCode === mgrCode || e.employeeCode === mgrCode)?.id;
    if (!reportingManagerId) errors.push(`Reporting Manager "${mgrCode}" not found (must already be an existing employee)`);
  }

  if (errors.length > 0 || !companyId || !departmentId || !designationId || !employeeTypeId || !joinDate) {
    return { errors };
  }

  const payload: BasicPayload = {
    companyId,
    departmentId,
    designationId,
    employeeTypeId,
    firstName,
    lastName,
    joinDate,
    status: 'active',
    title: get('Title') || undefined,
    middleName: get('Middle Name') || undefined,
    oldEmployeeCode: get('Device ID (Biometric)') || undefined,
    subDepartmentId: subDepartmentName ? byName(masters.subDepartments, subDepartmentName) : undefined,
    unitId: unitName ? byName(masters.units, unitName) : undefined,
    categoryId: categoryName ? byName(masters.categories, categoryName) : undefined,
    subCategory: get('Subcategory') || undefined,
    gradeId: gradeName ? byName(masters.grades, gradeName) : undefined,
    levelId: levelName ? byName(masters.levels, levelName) : undefined,
    productionLine: get('Production Line') || undefined,
    additionalRole: get('Additional Role') || undefined,
    teamGroup: get('Team Group') || undefined,
    // alreadyConfirmed → no probation period sent, so the create chain lands
    // straight on CONFIRMED (see creationChain in lib/employee/lifecycle.ts).
    probationPeriodMonths: alreadyConfirmed ? undefined : probationRaw ? Number(probationRaw) : undefined,
    shiftAssignmentType: get('Shift Assignment Type (GENERAL/ROTATIONAL)') || undefined,
    reportingManagerId,
  };

  return { payload, errors: [] };
}

function parseJobProfileRow(row: Record<string, unknown>): { payload?: JobProfilePayload; errors: string[] } {
  const g = (c: JobProfileColumn) => row[c];
  return {
    payload: {
      wageType: str(g('Wage Type')) || undefined,
      paymentMode: str(g('Payment Mode')) || undefined,
      officialEmail: str(g('Official Email')) || undefined,
      petrolAllowance: bool(g('Petrol Allowance (Yes/No)')),
      pfApplicable: str(g('PF Applicable (Yes/No)')) ? bool(g('PF Applicable (Yes/No)')) : true,
      esiApplicable: bool(g('ESI Applicable (Yes/No)')),
      professionalTaxApplicable: bool(g('Professional Tax Applicable (Yes/No)')),
      bonusApplicable: bool(g('Bonus Applicable (Yes/No)')),
      ltaEligible: bool(g('LTA Eligible (Yes/No)')),
      pfRestrictionAmount: num(g('PF Restriction Amount')),
      overtimeAllowed: bool(g('Overtime Allowed (Yes/No)')),
      overtimeFactor: num(g('Overtime Factor')),
      overtimeRatePerHour: num(g('Overtime Rate Per Hour')),
      lossOfMinutesDeductionApplicable: bool(g('Loss of Minutes Deduction Applicable (Yes/No)')),
      allowedLossOfMinutes: num(g('Allowed Loss of Minutes')),
      numberOfLeavesAllowed: num(g('Number of Leaves Allowed')),
      permissionRequestAllowed: bool(g('Permission Request Allowed (Yes/No)')),
      permissionHours: num(g('Permission Hours')),
    },
    errors: [],
  };
}

function parsePersonalRow(row: Record<string, unknown>): { payload?: PersonalPayload; errors: string[] } {
  const g = (c: PersonalColumn) => row[c];
  return {
    payload: {
      personal: {
        dateOfBirth: toIsoDate(g('Date of Birth (YYYY-MM-DD)')) ?? undefined,
        gender: str(g('Gender')) || undefined,
        bloodGroup: str(g('Blood Group')) || undefined,
        maritalStatus: str(g('Marital Status')) || undefined,
        marriageDate: toIsoDate(g('Marriage Date (YYYY-MM-DD)')) ?? undefined,
        numberOfChildren: num(g('Number of Children')),
        nationality: str(g('Nationality')) || undefined,
        religion: str(g('Religion')) || undefined,
        category: str(g('Personal Category')) || undefined,
        physicallyChallenged: bool(g('Physically Challenged (Yes/No)')),
        physicallyChallengedCategory: str(g('Physically Challenged Category')) || undefined,
        internationalWorker: bool(g('International Worker (Yes/No)')),
        heightCm: num(g('Height (cm)')),
        weightKg: num(g('Weight (kg)')),
        shirtSize: str(g('Shirt Size')) || undefined,
        pantSize: str(g('Pant Size')) || undefined,
      },
      contact: {
        permanentAddressLine1: str(g('Permanent Address Line 1')) || undefined,
        permanentAddressLine2: str(g('Permanent Address Line 2')) || undefined,
        permanentCity: str(g('Permanent City')) || undefined,
        permanentState: str(g('Permanent State')) || undefined,
        permanentPincode: str(g('Permanent Pincode')) || undefined,
        permanentMobile: str(g('Permanent Mobile')) || undefined,
        sameAsPermanent: bool(g('Same As Permanent (Yes/No)')),
        presentAddressLine1: str(g('Present Address Line 1')) || undefined,
        presentAddressLine2: str(g('Present Address Line 2')) || undefined,
        presentCity: str(g('Present City')) || undefined,
        presentState: str(g('Present State')) || undefined,
        presentPincode: str(g('Present Pincode')) || undefined,
        presentMobile: str(g('Present Mobile')) || undefined,
      },
    },
    errors: [],
  };
}

function parseCtcRow(row: Record<string, unknown>): { payload?: CtcPayload; errors: string[] } {
  const errors: string[] = [];
  for (const col of CTC_REQUIRED) {
    if (!str(row[col])) errors.push(`${col} is required`);
  }
  const effectiveFrom = toIsoDate(row['Effective From (YYYY-MM-DD)']);
  if (str(row['Effective From (YYYY-MM-DD)']) && !effectiveFrom) errors.push('Effective From is not a valid date');
  if (errors.length > 0 || !effectiveFrom) return { errors };

  const n = (c: CtcColumn) => num(row[c]) ?? 0;
  const payload: CtcPayload = {
    effectiveFrom,
    basic: n('Basic'),
    hra: n('HRA'),
    specialAllowance: n('Special Allowance'),
    conveyanceAllowance: n('Conveyance Allowance'),
    washAllowance: n('Wash Allowance'),
    canteen: n('Canteen'),
    dislocationAllowance: n('Dislocation Allowance'),
    otherAllowance: n('Other Allowance'),
    shiftAllowance: n('Shift Allowance'),
    attendanceBonus: n('Attendance Bonus'),
    bonus: n('Bonus'),
    lta: n('LTA'),
    medicalClaim: n('Medical Claim'),
    employeePf: n('Employee PF'),
    employeeEsi: n('Employee ESI'),
    employerPf: n('Employer PF'),
    employerEsi: n('Employer ESI'),
    gratuity: n('Gratuity'),
    otherBenefits: n('Other Benefits'),
    nonMonetaryBenefits: n('Non-Monetary Benefits'),
    monthlyCtc: n('Monthly CTC'),
    annualCtc: n('Annual CTC'),
  };
  if (payload.monthlyCtc < payload.basic) errors.push('Monthly CTC cannot be less than Basic');
  if (errors.length > 0) return { errors };
  return { payload, errors: [] };
}

function parseSalaryRow(row: Record<string, unknown>, masters: BulkImportMasters): { payload?: SalaryPayload; errors: string[] } {
  const errors: string[] = [];
  const effectiveFrom = toIsoDate(row['Effective From (YYYY-MM-DD)']);
  if (!str(row['Effective From (YYYY-MM-DD)'])) errors.push('Effective From is required');
  else if (!effectiveFrom) errors.push('Effective From is not a valid date');

  const components: { salaryComponentId: number; amount: number }[] = [];
  let grossSalary = 0;
  for (const comp of masters.salaryComponents) {
    const amount = num(row[comp.name]);
    if (amount !== undefined && amount > 0) {
      components.push({ salaryComponentId: comp.id, amount });
      grossSalary += amount;
    }
  }
  if (components.length === 0) errors.push('At least one salary component amount is required');

  if (errors.length > 0 || !effectiveFrom) return { errors };

  return {
    payload: {
      effectiveFrom,
      financialYear: str(row['Financial Year (e.g. 2025-26)']) || undefined,
      grossSalary,
      components,
    },
    errors: [],
  };
}

function parsePassportRow(row: Record<string, unknown>): { payload?: PassportPayload; errors: string[] } {
  const g = (c: PassportColumn) => row[c];
  const issueDate = toIsoDate(g('Issue Date (YYYY-MM-DD)')) ?? undefined;
  const expiryDate = toIsoDate(g('Expiry Date (YYYY-MM-DD)')) ?? undefined;
  const errors: string[] = [];
  if (issueDate && expiryDate && expiryDate <= issueDate) errors.push('Expiry Date must be later than Issue Date');
  if (errors.length > 0) return { errors };
  return {
    payload: {
      passportNumber: str(g('Passport Number')) || undefined,
      placeOfIssue: str(g('Place of Issue')) || undefined,
      countryOfIssue: str(g('Country of Issue')) || undefined,
      issueDate,
      expiryDate,
      verificationStatus: str(g('Verification Status')) || undefined,
    },
    errors: [],
  };
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^\d{12}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function parseKycRow(row: Record<string, unknown>): { payload?: KycPayload; errors: string[] } {
  const errors: string[] = [];
  for (const col of KYC_REQUIRED) {
    if (!str(row[col])) errors.push(`${col} is required`);
  }
  const pan = str(row['PAN Number']).toUpperCase();
  const aadhaar = str(row['Aadhaar Number']).replace(/\s/g, '');
  const ifsc = str(row['IFSC Code']).toUpperCase();
  if (pan && !PAN_RE.test(pan)) errors.push('PAN Number format is invalid (e.g. ABCDE1234F)');
  if (aadhaar && !AADHAAR_RE.test(aadhaar)) errors.push('Aadhaar Number must be 12 digits');
  if (ifsc && !IFSC_RE.test(ifsc)) errors.push('IFSC Code format is invalid');

  if (errors.length > 0) return { errors };

  return {
    payload: {
      panNumber: pan,
      aadhaarNumber: aadhaar,
      bankName: str(row['Bank Name']) || undefined,
      branchName: str(row['Branch Name']) || undefined,
      accountNumber: str(row['Bank Account Number']),
      ifscCode: ifsc,
      accountType: str(row['Account Type (savings/current)']) || undefined,
      uanNumber: str(row['UAN Number']) || undefined,
      esiNumber: str(row['ESI Number']) || undefined,
      pfNumber: str(row['PF Number']) || undefined,
    },
    errors: [],
  };
}

// ─── repeatable-row section parsers ─────────────────────────────────────────

function parseEducationRow(row: Record<string, unknown>): { payload?: EducationPayload; errors: string[] } {
  const g = (c: EducationColumn) => row[c];
  const qualification = str(g('Qualification'));
  if (!qualification) return { errors: ['Qualification is required'] };
  return {
    payload: {
      qualification,
      institution: str(g('Institution')) || undefined,
      university: str(g('University')) || undefined,
      yearOfPassing: num(g('Year of Passing')),
      percentage: num(g('Percentage')),
    },
    errors: [],
  };
}

function parseExperienceRow(row: Record<string, unknown>): { payload?: ExperiencePayload; errors: string[] } {
  const g = (c: ExperienceColumn) => row[c];
  const errors: string[] = [];
  const companyName = str(g('Company Name'));
  const designation = str(g('Previous Designation'));
  const fromDate = toIsoDate(g('From Date (YYYY-MM-DD)'));
  const toDate = toIsoDate(g('To Date (YYYY-MM-DD)')) ?? undefined;
  if (!companyName) errors.push('Company Name is required');
  if (!designation) errors.push('Previous Designation is required');
  if (!fromDate) errors.push('From Date is required');
  if (fromDate && toDate && toDate < fromDate) errors.push('To Date cannot be earlier than From Date');
  if (errors.length > 0 || !fromDate) return { errors };
  return {
    payload: {
      companyName,
      designation,
      fromDate,
      toDate,
      reasonForLeaving: str(g('Reason for Leaving')) || undefined,
      lastDrawnSalary: num(g('Last Drawn Salary')),
    },
    errors: [],
  };
}

function parseDependentRow(row: Record<string, unknown>): { payload?: DependentPayload; errors: string[] } {
  const g = (c: DependentColumn) => row[c];
  const name = str(g('Dependent Name'));
  const relationship = str(g('Relationship'));
  const errors: string[] = [];
  if (!name) errors.push('Dependent Name is required');
  if (!relationship) errors.push('Relationship is required');
  if (errors.length > 0) return { errors };
  return {
    payload: {
      name,
      relationship,
      dateOfBirth: toIsoDate(g('Date of Birth (YYYY-MM-DD)')) ?? undefined,
      isDependent: str(g('Is Dependent (Yes/No)')) ? bool(g('Is Dependent (Yes/No)')) : true,
    },
    errors: [],
  };
}

function parseEmergencyContactRow(row: Record<string, unknown>): { payload?: EmergencyContactPayload; errors: string[] } {
  const g = (c: EmergencyContactColumn) => row[c];
  const contactName = str(g('Contact Name'));
  const relationship = str(g('Relationship'));
  const errors: string[] = [];
  if (!contactName) errors.push('Contact Name is required');
  if (!relationship) errors.push('Relationship is required');
  if (errors.length > 0) return { errors };
  return {
    payload: {
      contactName,
      relationship,
      address: str(g('Address')) || undefined,
      homePhone: str(g('Home Phone')) || undefined,
      mobile: str(g('Mobile')) || undefined,
      alternatePhone: str(g('Alternate Phone')) || undefined,
      email: str(g('Email')) || undefined,
      isPrimary: bool(g('Is Primary (Yes/No)')),
      remarks: str(g('Remarks')) || undefined,
    },
    errors: [],
  };
}

function parseBenefitRow(row: Record<string, unknown>, masters: BulkImportMasters): { payload?: BenefitRow; errors: string[] } {
  const g = (c: BenefitsColumn) => row[c];
  const code = str(g('Benefit Rate Code (see Reference Lists)'));
  if (!code) return { errors: ['Benefit Rate Code is required'] };
  const benefitRateId = byCode(masters.benefitRates, code);
  if (!benefitRateId) return { errors: [`Benefit Rate Code "${code}" not found`] };
  return { payload: { benefitRateId }, errors: [] };
}

function parseAssetRow(row: Record<string, unknown>, masters: BulkImportMasters): { payload?: AssetPayload; errors: string[] } {
  const g = (c: AssetColumn) => row[c];
  const typeName = str(g('Asset Type (see Reference Lists)'));
  const errors: string[] = [];
  if (!typeName) errors.push('Asset Type is required');
  const assetMasterId = typeName ? byName(masters.assetMasters, typeName) : undefined;
  if (typeName && !assetMasterId) errors.push(`Asset Type "${typeName}" not found`);
  const allocatedDate = toIsoDate(g('Issue Date (YYYY-MM-DD)')) ?? new Date().toISOString().slice(0, 10);
  if (errors.length > 0 || !assetMasterId) return { errors };
  return {
    payload: {
      assetMasterId,
      serialNumber: str(g('Serial Number')) || undefined,
      model: str(g('Model')) || undefined,
      assetValue: num(g('Asset Value')),
      allocatedDate,
      expectedReturnDate: toIsoDate(g('Expected Return Date (YYYY-MM-DD)')) ?? undefined,
      notes: str(g('Notes')) || undefined,
    },
    errors: [],
  };
}

function parseSkillRow(row: Record<string, unknown>): { payload?: SkillPayload; errors: string[] } {
  const g = (c: SkillColumn) => row[c];
  const skillName = str(g('Skill / Machine / Operation'));
  if (!skillName) return { errors: ['Skill / Machine / Operation is required'] };
  return {
    payload: {
      skillCategory: str(g('Skill Category')) || undefined,
      skillName,
      proficiencyLevel: str(g('Proficiency Level')) || undefined,
      levelPercentage: num(g('Level %')),
      certified: bool(g('Certified (Yes/No)')),
      certificateNumber: str(g('Certificate Number')) || undefined,
      certifiedDate: toIsoDate(g('Certified Date (YYYY-MM-DD)')) ?? undefined,
      expiryDate: toIsoDate(g('Expiry Date (YYYY-MM-DD)')) ?? undefined,
      evaluatedBy: str(g('Evaluated By')) || undefined,
      remarks: str(g('Remarks')) || undefined,
    },
    errors: [],
  };
}

/**
 * Reads all sheets and groups rows by the Employee Code column. Rows whose
 * code cell is blank are skipped (reported separately, not silently
 * dropped) — a blank code can't be joined to anything.
 */
export function parseImportWorkbook(
  file: ArrayBuffer,
  masters: BulkImportMasters,
  existingCodes: Set<string>
): { rows: EmployeeImportRow[]; sheetsFound: string[]; blankCodeRows: { sheet: string; row: number }[] } {
  const wb = XLSX.read(file, { type: 'array', cellDates: true });
  const sheetsFound = wb.SheetNames;
  const byCodeMap = new Map<string, EmployeeImportRow>();
  const blankCodeRows: { sheet: string; row: number }[] = [];

  const ensure = (code: string): EmployeeImportRow => {
    let r = byCodeMap.get(code);
    if (!r) {
      r = {
        code,
        displayName: code,
        isNewEmployee: !existingCodes.has(code.toUpperCase()),
        basic: { present: false, errors: [] },
        jobProfile: { present: false, errors: [] },
        ctc: { present: false, errors: [] },
        salary: { present: false, errors: [] },
        kyc: { present: false, errors: [] },
        personal: { present: false, errors: [] },
        passport: { present: false, errors: [] },
        education: [],
        experience: [],
        dependents: [],
        emergencyContacts: [],
        benefits: [],
        assets: [],
        skills: [],
        blocked: false,
        blockReasons: [],
        warnings: [],
      };
      byCodeMap.set(code, r);
    }
    return r;
  };

  function forEachRow(sheetName: string, fn: (code: string, row: Record<string, unknown>, rowNum: number) => void) {
    const rows = sheetRows(wb, sheetName);
    if (!rows) return;
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const code = str(row[CODE_COL]);
      if (!code) {
        blankCodeRows.push({ sheet: sheetName, row: rowNum });
        return;
      }
      fn(code, row, rowNum);
    });
  }

  forEachRow('Basic', (code, row) => {
    const entry = ensure(code);
    const { payload, errors } = parseBasicRow(row, masters);
    entry.basic = { present: true, payload, errors };
    if (payload) entry.displayName = `${payload.firstName} ${payload.lastName}`.trim();
  });
  forEachRow('Job Profile', (code, row) => {
    const { payload, errors } = parseJobProfileRow(row);
    ensure(code).jobProfile = { present: true, payload, errors };
  });
  forEachRow('Personal & Contact', (code, row) => {
    const { payload, errors } = parsePersonalRow(row);
    ensure(code).personal = { present: true, payload, errors };
  });
  forEachRow('CTC', (code, row) => {
    const { payload, errors } = parseCtcRow(row);
    ensure(code).ctc = { present: true, payload, errors };
  });
  forEachRow('Salary', (code, row) => {
    const { payload, errors } = parseSalaryRow(row, masters);
    ensure(code).salary = { present: true, payload, errors };
  });
  forEachRow('Passport', (code, row) => {
    const { payload, errors } = parsePassportRow(row);
    ensure(code).passport = { present: true, payload, errors };
  });
  forEachRow('KYC & Statutory', (code, row) => {
    const { payload, errors } = parseKycRow(row);
    ensure(code).kyc = { present: true, payload, errors };
  });
  forEachRow('Education', (code, row, rowNum) => {
    const { payload, errors } = parseEducationRow(row);
    ensure(code).education.push({ row: rowNum, payload, errors });
  });
  forEachRow('Experience', (code, row, rowNum) => {
    const { payload, errors } = parseExperienceRow(row);
    ensure(code).experience.push({ row: rowNum, payload, errors });
  });
  forEachRow('Dependents', (code, row, rowNum) => {
    const { payload, errors } = parseDependentRow(row);
    ensure(code).dependents.push({ row: rowNum, payload, errors });
  });
  forEachRow('Emergency Contacts', (code, row, rowNum) => {
    const { payload, errors } = parseEmergencyContactRow(row);
    ensure(code).emergencyContacts.push({ row: rowNum, payload, errors });
  });
  forEachRow('Benefits', (code, row, rowNum) => {
    const { payload, errors } = parseBenefitRow(row, masters);
    ensure(code).benefits.push({ row: rowNum, payload, errors });
  });
  forEachRow('Assets', (code, row, rowNum) => {
    const { payload, errors } = parseAssetRow(row, masters);
    ensure(code).assets.push({ row: rowNum, payload, errors });
  });
  forEachRow('Skills', (code, row, rowNum) => {
    const { payload, errors } = parseSkillRow(row);
    ensure(code).skills.push({ row: rowNum, payload, errors });
  });

  return { rows: Array.from(byCodeMap.values()), sheetsFound, blankCodeRows };
}

/**
 * Mandatory-sheet-presence + field-level validation on the five mandatory
 * sheets, mutating `blocked` / `blockReasons` on each row in place.
 * Repeatable-sheet row errors never block — they're collected into
 * `warnings` instead, and the write step simply skips those individual rows.
 */
export function validateBatch(rows: EmployeeImportRow[]): void {
  for (const r of rows) {
    const reasons: string[] = [];

    if (!r.basic.present) reasons.push('Missing on Basic sheet (mandatory)');
    else if (r.basic.errors.length) reasons.push(...r.basic.errors.map((e) => `Basic: ${e}`));

    if (!r.jobProfile.present) reasons.push('Missing on Job Profile sheet (mandatory)');
    else if (r.jobProfile.errors.length) reasons.push(...r.jobProfile.errors.map((e) => `Job Profile: ${e}`));

    if (!r.ctc.present) reasons.push('Missing on CTC sheet (mandatory)');
    else if (r.ctc.errors.length) reasons.push(...r.ctc.errors.map((e) => `CTC: ${e}`));

    if (!r.salary.present) reasons.push('Missing on Salary sheet (mandatory)');
    else if (r.salary.errors.length) reasons.push(...r.salary.errors.map((e) => `Salary: ${e}`));

    if (!r.kyc.present) reasons.push('Missing on KYC & Statutory sheet (mandatory)');
    else if (r.kyc.errors.length) reasons.push(...r.kyc.errors.map((e) => `KYC: ${e}`));

    r.blockReasons = reasons;
    r.blocked = reasons.length > 0;

    const warnings: string[] = [];
    if (r.personal.errors.length) warnings.push(...r.personal.errors.map((e) => `Personal & Contact: ${e}`));
    if (r.passport.errors.length) warnings.push(...r.passport.errors.map((e) => `Passport: ${e}`));
    const repeatables: [string, RepeatableOutcome<unknown>[]][] = [
      ['Education', r.education], ['Experience', r.experience], ['Dependents', r.dependents],
      ['Emergency Contacts', r.emergencyContacts], ['Benefits', r.benefits], ['Assets', r.assets], ['Skills', r.skills],
    ];
    for (const [name, list] of repeatables) {
      for (const item of list) {
        if (item.errors.length) warnings.push(`${name} row ${item.row}: ${item.errors.join('; ')} — this row will be skipped`);
      }
    }
    r.warnings = warnings;
  }
}

/** Builds a workbook containing only the given rows' sheets, with Status/Error columns appended. */
export function buildErrorWorkbook(rows: EmployeeImportRow[], masters: BulkImportMasters): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const salaryColumns = [...SALARY_FIXED_COLUMNS, ...masters.salaryComponents.map((c) => c.name)];

  function addSingleSheet(name: string, columns: readonly string[], pick: (r: EmployeeImportRow) => { present: boolean; errors: string[] }) {
    const header = [...columns, 'Status', 'Error'];
    const body: (string | number)[][] = [];
    for (const r of rows) {
      const outcome = pick(r);
      const status = !outcome.present ? 'MISSING' : outcome.errors.length ? 'ERROR' : 'OK';
      const errorText = !outcome.present ? 'No row on this sheet for this Employee Code' : outcome.errors.join('; ');
      const cells = columns.map((c) => (c === CODE_COL ? r.code : ''));
      body.push([...cells, status, errorText]);
    }
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet['!cols'] = header.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }

  addSingleSheet('Basic', BASIC_COLUMNS, (r) => r.basic);
  addSingleSheet('Job Profile', JOB_PROFILE_COLUMNS, (r) => r.jobProfile);
  addSingleSheet('CTC', CTC_COLUMNS, (r) => r.ctc);
  addSingleSheet('Salary', salaryColumns, (r) => r.salary);
  addSingleSheet('KYC & Statutory', KYC_COLUMNS, (r) => r.kyc);

  const summary: (string | number)[][] = [
    ['Employee Code', 'Name', 'Status', 'Blocking Reasons', 'Warnings (repeatable rows skipped)'],
    ...rows.map((r) => [r.code, r.displayName, r.blocked ? 'BLOCKED' : 'OK', r.blockReasons.join('; '), r.warnings.join('; ')]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 12 }, { wch: 60 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  return wb;
}
