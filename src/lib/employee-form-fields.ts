/**
 * Shared field definitions for the 4 Phase-1 Employee tabs — used by both
 * the Add Employee page and the profile's Basic/Personal/Contact/Job Profile
 * tabs, so Add and Edit never drift out of sync (spec: "Add and Edit must
 * share reusable form components").
 */

import type { FieldDef } from '@/components/ui';

export type OptionList = { id: number; name: string }[];

export function toOptions(list: OptionList) {
  return list.map((o) => ({ label: o.name, value: o.id }));
}

export async function fetchAllMaster(path: string): Promise<OptionList> {
  const res = await fetch(`/api/masters/${path}?limit=500`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export interface EmployeeRef {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode: string;
  oldEmployeeCode: string | null;
}

/**
 * Reporting-manager options are searchable by either the company-issued
 * Employee Code (`oldEmployeeCode` — manually entered, may be blank) or the
 * system-generated Reference Code (`employeeCode` — always present) — both
 * are folded into the option label so a native <select>'s browser typeahead
 * can jump to either.
 */
export async function fetchEmployeeRefs(excludeId?: number): Promise<EmployeeRef[]> {
  const res = await fetch('/api/employees?limit=500');
  if (!res.ok) return [];
  const json = await res.json();
  const list: EmployeeRef[] = (json.data ?? []).map((e: EmployeeRef) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    employeeCode: e.employeeCode,
    oldEmployeeCode: e.oldEmployeeCode,
  }));
  return excludeId ? list.filter((e) => e.id !== excludeId) : list;
}

export function toReportingManagerOptions(list: EmployeeRef[]) {
  return list.map((e) => ({
    label: `${e.firstName} ${e.lastName}${e.oldEmployeeCode ? ` — ${e.oldEmployeeCode}` : ''} (Ref: ${e.employeeCode})`,
    value: e.id,
  }));
}

export interface BasicFieldOptions {
  companies: OptionList;
  units: OptionList;
  departments: OptionList;
  subDepartments: OptionList;
  designations: OptionList;
  employeeTypes: OptionList;
  categories: OptionList;
  grades: OptionList;
  levels: OptionList;
  shiftMasters: OptionList;
  shiftPlans: OptionList;
  reportingManagers: EmployeeRef[];
}

export function buildBasicFields(opts: BasicFieldOptions): FieldDef[] {
  return [
    {
      name: 'title',
      label: 'Title',
      type: 'select',
      options: [
        { label: 'Mr', value: 'Mr' },
        { label: 'Mrs', value: 'Mrs' },
        { label: 'Ms', value: 'Ms' },
        { label: 'Dr', value: 'Dr' },
      ],
    },
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'middleName', label: 'Middle Name', type: 'text' },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    {
      name: 'employeeCode',
      label: 'Reference Code',
      type: 'text',
      disabled: true,
      helpText: 'Automatically generated on save (e.g. EMP001) — not editable',
    },
    { name: 'oldEmployeeCode', label: 'Employee Code', type: 'text' },
    { name: 'companyId', label: 'Company', type: 'select', required: true, options: toOptions(opts.companies) },
    { name: 'unitId', label: 'Unit / Branch / Site', type: 'select', options: toOptions(opts.units) },
    { name: 'departmentId', label: 'Department', type: 'select', required: true, options: toOptions(opts.departments) },
    { name: 'subDepartmentId', label: 'Sub Department', type: 'select', options: toOptions(opts.subDepartments) },
    { name: 'designationId', label: 'Designation', type: 'select', required: true, options: toOptions(opts.designations) },
    { name: 'employeeTypeId', label: 'Employee Type', type: 'select', required: true, options: toOptions(opts.employeeTypes) },
    { name: 'categoryId', label: 'Category', type: 'select', options: toOptions(opts.categories) },
    { name: 'subCategory', label: 'Subcategory', type: 'text' },
    { name: 'gradeId', label: 'Grade', type: 'select', options: toOptions(opts.grades) },
    { name: 'levelId', label: 'Level', type: 'select', options: toOptions(opts.levels) },
    { name: 'productionLine', label: 'Production Line', type: 'text' },
    { name: 'additionalRole', label: 'Additional Role', type: 'text' },
    { name: 'teamGroup', label: 'Team Group', type: 'text' },
    {
      name: 'reportingManagerId',
      label: 'Reporting Manager',
      type: 'select',
      options: toReportingManagerOptions(opts.reportingManagers),
    },
    {
      name: 'status',
      label: 'Employee Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'On Leave', value: 'on-leave' },
        { label: 'Terminated', value: 'terminated' },
        { label: 'Resigned', value: 'resigned' },
      ],
    },
    { name: 'joinDate', label: 'Date of Joining', type: 'date', required: true },
    {
      name: 'probationPeriodMonths',
      label: 'Probation Period (months)',
      type: 'select',
      options: [
        { label: '3', value: 3 },
        { label: '6', value: 6 },
        { label: '9', value: 9 },
        { label: '12', value: 12 },
      ],
    },
    {
      name: 'probationEndDate',
      label: 'Probation End Date',
      type: 'date',
      disabled: true,
      helpText: 'Calculated automatically from Date of Joining + Probation Period',
    },
    {
      name: 'confirmationDate',
      label: 'Confirmation Date',
      type: 'date',
      disabled: true,
      helpText: 'Set automatically when confirmation is approved — see Employees > Lifecycle > Confirmation',
    },
    { name: 'shiftMasterId', label: 'Shift', type: 'select', options: toOptions(opts.shiftMasters) },
    { name: 'shiftPlanId', label: 'Shift Plan', type: 'select', options: toOptions(opts.shiftPlans) },
  ];
}

export function buildPersonalFields(): FieldDef[] {
  return [
    {
      name: 'gender',
      label: 'Gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    {
      name: 'maritalStatus',
      label: 'Marital Status',
      type: 'select',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Married', value: 'married' },
      ],
    },
    { name: 'marriageDate', label: 'Marriage Date', type: 'date' },
    { name: 'numberOfChildren', label: 'Number of Children', type: 'number', min: 0 },
    { name: 'personalEmail', label: 'Personal Email', type: 'email' },
    { name: 'nationality', label: 'Nationality', type: 'text' },
    { name: 'bloodGroup', label: 'Blood Group', type: 'text' },
    { name: 'religion', label: 'Religion', type: 'text' },
    { name: 'heightCm', label: 'Height (cm)', type: 'number' },
    { name: 'weightKg', label: 'Weight (kg)', type: 'number' },
    { name: 'shirtSize', label: 'Shirt Size', type: 'text' },
    { name: 'pantSize', label: 'Pant Size', type: 'text' },
    { name: 'shoeSize', label: 'Shoe Size', type: 'text' },
    { name: 'issuedMobileNumber', label: 'Issued Mobile Number', type: 'text' },
    { name: 'mobileDeductionApplicable', label: 'Mobile Deduction Applicable', type: 'checkbox' },
    { name: 'canteenAllowanceApplicable', label: 'Canteen Allowance Applicable', type: 'checkbox' },
    { name: 'loanInstalmentMonth', label: 'Loan Instalment Month', type: 'text' },
    { name: 'physicallyChallenged', label: 'Physically Challenged', type: 'checkbox' },
    { name: 'physicallyChallengedCategory', label: 'Physically Challenged Category', type: 'text' },
    { name: 'internationalWorker', label: 'International Worker', type: 'checkbox' },
    { name: 'ndaDocument', label: 'NDA Document', type: 'checkbox' },
    { name: 'fitnessCertificate', label: 'Fitness Certificate', type: 'checkbox' },
  ];
}

// From Organization.rpt — STATE / STATE_CD (32 rows). Fixed Indian-states
// reference list — hardcoded like Gender/Marital Status/etc. above rather
// than a DB master, since it's a closed, effectively-static enumeration.
const INDIAN_STATES = [
  'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHATTISGARH',
  'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH',
  'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA',
  'LAKSHADWEEP ISLANDS', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
  'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PONDICHERRY', 'PUNJAB',
  'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA',
  'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL',
];
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ label: s, value: s }));

/**
 * `sameAsPermanent` disables + visually locks the present-address fields,
 * since syncPresentAddressIfSame keeps them mirrored automatically while
 * it's checked — editing them directly would just be overwritten.
 */
export function buildContactFields(sameAsPermanent = false): FieldDef[] {
  return [
    { name: 'permanentAddressLine1', label: 'Permanent Address Line 1', type: 'text' },
    { name: 'permanentAddressLine2', label: 'Permanent Address Line 2', type: 'text' },
    { name: 'permanentCity', label: 'Permanent City', type: 'text' },
    { name: 'permanentState', label: 'Permanent State', type: 'select', options: STATE_OPTIONS },
    { name: 'permanentPincode', label: 'Permanent PIN Code', type: 'text' },
    { name: 'permanentMobile', label: 'Mobile No', type: 'text', maxLength: 10 },
    { name: 'sameAsPermanent', label: 'Present Same as Permanent', type: 'checkbox' },
    { name: 'presentAddressLine1', label: 'Present Address Line 1', type: 'text', disabled: sameAsPermanent },
    { name: 'presentAddressLine2', label: 'Present Address Line 2', type: 'text', disabled: sameAsPermanent },
    { name: 'presentCity', label: 'Present City', type: 'text', disabled: sameAsPermanent },
    { name: 'presentState', label: 'Present State', type: 'select', options: STATE_OPTIONS, disabled: sameAsPermanent },
    { name: 'presentPincode', label: 'Present PIN Code', type: 'text', disabled: sameAsPermanent },
    { name: 'presentMobile', label: 'Mobile No', type: 'text', maxLength: 10, disabled: sameAsPermanent },
  ];
}

const PRESENT_TO_PERMANENT_MAP: Record<string, string> = {
  presentAddressLine1: 'permanentAddressLine1',
  presentAddressLine2: 'permanentAddressLine2',
  presentCity: 'permanentCity',
  presentState: 'permanentState',
  presentPincode: 'permanentPincode',
  presentMobile: 'permanentMobile',
};

/**
 * Applies one field change to a Contact Details `values` object, and — when
 * `sameAsPermanent` is (or becomes) true — mirrors every present-address
 * field from its permanent-address counterpart in the same update, so the
 * UI reflects the copy immediately rather than only on save.
 */
export function applyContactFieldChange(
  values: Record<string, string | number | boolean | undefined>,
  name: string,
  value: string | number | boolean
): Record<string, string | number | boolean | undefined> {
  const next = { ...values, [name]: value };
  const isNowSame = name === 'sameAsPermanent' ? Boolean(value) : Boolean(next.sameAsPermanent);
  const permanentFieldChanged = name.startsWith('permanent');

  if (isNowSame && (name === 'sameAsPermanent' || permanentFieldChanged)) {
    for (const [presentKey, permanentKey] of Object.entries(PRESENT_TO_PERMANENT_MAP)) {
      next[presentKey] = next[permanentKey];
    }
  }

  return next;
}

/**
 * Probation End Date = Date of Joining + Probation Period (months). Shared
 * by the client (live display) and the server (authoritative recompute on
 * every save — the client's displayed value is never trusted directly).
 */
export function calculateProbationEndDate(
  joinDate: Date | string | undefined | null,
  probationPeriodMonths: number | undefined | null
): Date | null {
  if (!joinDate || !probationPeriodMonths) return null;
  const d = new Date(joinDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + probationPeriodMonths);
  return d;
}

/**
 * Applies one field change to a Basic Details `values` object and — when
 * Date of Joining or Probation Period changes — recomputes the displayed
 * (read-only) Probation End Date immediately. Also runs every change
 * through applyContactFieldChange, which is a no-op outside Contact
 * Details, so both tabs' pages can share one handler.
 */
export function applyEmployeeFieldChange(
  values: Record<string, string | number | boolean | undefined>,
  name: string,
  value: string | number | boolean
): Record<string, string | number | boolean | undefined> {
  const next = applyContactFieldChange(values, name, value);

  if (name === 'joinDate' || name === 'probationPeriodMonths') {
    const joinDate = (name === 'joinDate' ? value : next.joinDate) as string | undefined;
    const months = (name === 'probationPeriodMonths' ? value : next.probationPeriodMonths) as
      | number
      | undefined;
    const computed = calculateProbationEndDate(joinDate, months);
    next.probationEndDate = computed ? computed.toISOString().slice(0, 10) : undefined;
  }

  return next;
}

export function buildJobProfileFields(): FieldDef[] {
  return [
    {
      name: 'wageType',
      label: 'Wage Type',
      type: 'select',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Daily', value: 'daily' },
        { label: 'Hourly', value: 'hourly' },
      ],
    },
    {
      name: 'paymentMode',
      label: 'Payment Mode',
      type: 'select',
      options: [
        { label: 'Bank', value: 'bank' },
        { label: 'Cash', value: 'cash' },
        { label: 'Cheque', value: 'cheque' },
      ],
    },
    { name: 'officialEmail', label: 'Official Email', type: 'email' },
    { name: 'petrolAllowance', label: 'Petrol Allowance', type: 'checkbox' },
    { name: 'esiApplicable', label: 'ESI Applicable', type: 'checkbox' },
    { name: 'professionalTaxApplicable', label: 'Professional Tax Applicable', type: 'checkbox' },
    { name: 'bonusApplicable', label: 'Bonus Applicable', type: 'checkbox' },
    { name: 'ltaEligible', label: 'LTA/UTA Eligible', type: 'checkbox' },
    { name: 'pfRestrictionAmount', label: 'PF Restriction Amount', type: 'number' },
    { name: 'overtimeAllowed', label: 'Overtime Allowed', type: 'checkbox' },
    { name: 'overtimeFactor', label: 'Overtime Factor', type: 'number', step: '0.1' },
    { name: 'overtimeRatePerHour', label: 'Overtime Rate / Hour', type: 'number' },
    { name: 'lossOfMinutesDeductionApplicable', label: 'Loss of Minutes Deduction Applicable', type: 'checkbox' },
    { name: 'allowedLossOfMinutes', label: 'Allowed Loss of Minutes', type: 'number' },
    { name: 'numberOfLeavesAllowed', label: 'Number of Leaves Allowed', type: 'number' },
    { name: 'permissionRequestAllowed', label: 'Permission Request Allowed', type: 'checkbox' },
    { name: 'permissionHours', label: 'Permission Hours', type: 'number' },
    { name: 'companyContact1', label: 'Company Contact 1', type: 'text' },
    { name: 'companyContact2', label: 'Company Contact 2', type: 'text' },
    { name: 'ipAddress1', label: 'IP Address 1', type: 'text' },
    { name: 'ipAddress2', label: 'IP Address 2', type: 'text' },
  ];
}

// ─── Phase 2 tabs — repeatable-record field defs ─────────────────────────────

export function buildEducationFields(): FieldDef[] {
  return [
    { name: 'qualification', label: 'Qualification', type: 'text', required: true, placeholder: 'e.g. B.Tech' },
    { name: 'institution', label: 'Institution Name', type: 'text' },
    { name: 'university', label: 'University', type: 'text' },
    { name: 'yearOfPassing', label: 'Year of Passing', type: 'number', min: 1900, max: 2100 },
    { name: 'percentage', label: 'Percentage / Grade', type: 'number', min: 0, max: 100 },
  ];
}

export function buildExperienceFields(): FieldDef[] {
  return [
    { name: 'companyName', label: 'Company Name', type: 'text', required: true },
    { name: 'designation', label: 'Previous Designation', type: 'text', required: true },
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date' },
    { name: 'lastDrawnSalary', label: 'Last Drawn Salary', type: 'number' },
    { name: 'reasonForLeaving', label: 'Reason for Leaving', type: 'textarea' },
  ];
}

export function buildDependentFields(): FieldDef[] {
  return [
    { name: 'name', label: 'Dependent Name', type: 'text', required: true },
    {
      name: 'relationship',
      label: 'Relationship',
      type: 'select',
      required: true,
      options: [
        { label: 'Spouse', value: 'spouse' },
        { label: 'Son', value: 'son' },
        { label: 'Daughter', value: 'daughter' },
        { label: 'Father', value: 'father' },
        { label: 'Mother', value: 'mother' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
    { name: 'isDependent', label: 'Is Dependent', type: 'checkbox', defaultValue: true },
  ];
}

export function buildEmergencyContactFields(): FieldDef[] {
  return [
    { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
    { name: 'relationship', label: 'Relationship', type: 'text', required: true },
    { name: 'mobile', label: 'Mobile Number', type: 'text', maxLength: 10 },
    { name: 'homePhone', label: 'Home Phone Number', type: 'text' },
    { name: 'alternatePhone', label: 'Alternate Phone Number', type: 'text' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'isPrimary', label: 'Primary Contact', type: 'checkbox' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];
}

export function buildSkillFields(): FieldDef[] {
  return [
    { name: 'skillCategory', label: 'Skill Category', type: 'text' },
    { name: 'skillName', label: 'Skill / Machine / Operation', type: 'text', required: true },
    {
      name: 'proficiencyLevel',
      label: 'Proficiency Level',
      type: 'select',
      options: [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' },
        { label: 'Expert', value: 'expert' },
      ],
    },
    { name: 'levelPercentage', label: 'Level Percentage', type: 'number', min: 0, max: 100 },
    { name: 'certified', label: 'Certified', type: 'checkbox' },
    { name: 'certificateNumber', label: 'Certificate Number', type: 'text' },
    { name: 'certifiedDate', label: 'Certified Date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { name: 'evaluatedBy', label: 'Evaluated By', type: 'text' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];
}

export function buildPassportFields(): FieldDef[] {
  return [
    { name: 'passportNumber', label: 'Passport Number', type: 'text' },
    { name: 'placeOfIssue', label: 'Place of Issue', type: 'text' },
    { name: 'countryOfIssue', label: 'Country of Issue', type: 'text' },
    { name: 'issueDate', label: 'Issue Date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
    {
      name: 'verificationStatus',
      label: 'Verification Status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
  ];
}

export function buildKycFields(): FieldDef[] {
  return [
    { name: 'pfNumber', label: 'PF Number', type: 'text', maxLength: 30 },
    { name: 'uanNumber', label: 'UAN Number', type: 'text', maxLength: 20 },
    { name: 'esiNumber', label: 'ESI Number', type: 'text', maxLength: 20 },
    { name: 'panNumberMasked', label: 'PAN Number (on file)', type: 'text', disabled: true },
    { name: 'panNumber', label: 'New PAN Number', type: 'text', placeholder: 'Leave blank to keep the value on file', maxLength: 10 },
    { name: 'aadhaarNumberMasked', label: 'Aadhaar Number (on file)', type: 'text', disabled: true },
    { name: 'aadhaarNumber', label: 'New Aadhaar Number', type: 'text', placeholder: 'Leave blank to keep the value on file', maxLength: 12 },
    { name: 'drivingLicenceNumber', label: 'Driving Licence Number', type: 'text', maxLength: 30 },
    { name: 'drivingLicenceExpiry', label: 'Driving Licence Expiry', type: 'date' },
    { name: 'electionCardNumber', label: 'Election Card Number', type: 'text', maxLength: 30 },
    { name: 'rationCardNumber', label: 'Ration Card Number', type: 'text', maxLength: 30 },
    {
      name: 'verificationStatus',
      label: 'Verification Status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    { name: 'bankName', label: 'Bank Name', type: 'text', maxLength: 100 },
    { name: 'branchName', label: 'Branch Name', type: 'text', maxLength: 100 },
    { name: 'accountNumber', label: 'Account Number', type: 'text', maxLength: 30 },
    { name: 'ifscCode', label: 'IFSC Code', type: 'text', maxLength: 20 },
    {
      name: 'accountType',
      label: 'Account Type',
      type: 'select',
      options: [
        { label: 'Savings', value: 'savings' },
        { label: 'Current', value: 'current' },
        { label: 'Salary', value: 'salary' },
      ],
    },
  ];
}

export function buildCtcFields(): FieldDef[] {
  return [
    { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
    { name: 'basic', label: 'Basic', type: 'number', min: 0, required: true },
    { name: 'hra', label: 'HRA', type: 'number', min: 0 },
    { name: 'specialAllowance', label: 'Special Allowance', type: 'number', min: 0 },
    { name: 'conveyanceAllowance', label: 'Conveyance Allowance', type: 'number', min: 0 },
    { name: 'washAllowance', label: 'Wash Allowance', type: 'number', min: 0 },
    { name: 'canteen', label: 'Canteen', type: 'number', min: 0 },
    { name: 'dislocationAllowance', label: 'Dislocation Allowance', type: 'number', min: 0 },
    { name: 'otherAllowance', label: 'Other Allowance', type: 'number', min: 0 },
    { name: 'shiftAllowance', label: 'Shift Allowance', type: 'number', min: 0 },
    { name: 'attendanceBonus', label: 'Attendance Bonus', type: 'number', min: 0 },
    { name: 'bonus', label: 'Bonus', type: 'number', min: 0 },
    { name: 'lta', label: 'LTA', type: 'number', min: 0 },
    { name: 'medicalClaim', label: 'Medical Claim', type: 'number', min: 0 },
    { name: 'employeePf', label: 'Employee PF', type: 'number', min: 0 },
    { name: 'employeeEsi', label: 'Employee ESI', type: 'number', min: 0 },
    { name: 'employerPf', label: 'Employer PF', type: 'number', min: 0 },
    { name: 'employerEsi', label: 'Employer ESI', type: 'number', min: 0 },
    { name: 'gratuity', label: 'Gratuity', type: 'number', min: 0 },
    { name: 'otherBenefits', label: 'Other Benefits', type: 'number', min: 0 },
    { name: 'nonMonetaryBenefits', label: 'Non-Monetary Benefits', type: 'number', min: 0 },
    { name: 'monthlyCtc', label: 'Monthly CTC', type: 'number', min: 0, required: true },
    { name: 'annualCtc', label: 'Annual CTC', type: 'number', min: 0, required: true },
  ];
}

export function buildAssetFields(assetMasters: OptionList): FieldDef[] {
  return [
    { name: 'assetMasterId', label: 'Asset Type', type: 'select', required: true, options: toOptions(assetMasters) },
    { name: 'serialNumber', label: 'Serial Number', type: 'text', maxLength: 50 },
    { name: 'model', label: 'Model', type: 'text', maxLength: 100 },
    { name: 'assetValue', label: 'Asset Value', type: 'number', min: 0 },
    { name: 'allocatedDate', label: 'Issue Date', type: 'date', required: true },
    { name: 'expectedReturnDate', label: 'Expected Return Date', type: 'date' },
    { name: 'returnedDate', label: 'Actual Return Date', type: 'date' },
    { name: 'notes', label: 'Comments', type: 'textarea' },
  ];
}
