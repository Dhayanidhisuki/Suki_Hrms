/**
 * Zod validation schemas for Employee Master CRUD.
 * Shared validation core — used by both API routes and client-side forms.
 */

import { z } from 'zod';

// ─── PersonalDetails ─────────────────────────────────────────────────────────
// Address + emergency-contact fields live on contactDetailsSchema /
// emergencyContactSchema below (spec: Contact Details is a separate tab).

const phoneRegex = /^[0-9+\-\s()]{6,20}$/;
const pincodeRegex = /^[0-9]{4,10}$/;
const mobileRegex = /^[0-9]{1,10}$/;

export const personalDetailsSchema = z.object({
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  maritalStatus: z.string().max(20).optional().nullable(),
  marriageDate: z.coerce.date().optional().nullable(),
  numberOfChildren: z.number().int().min(0).optional().nullable(),
  nationality: z.string().max(50).optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  physicallyChallenged: z.boolean().default(false),
  physicallyChallengedCategory: z.string().max(50).optional().nullable(),
  internationalWorker: z.boolean().default(false),
  heightCm: z.coerce.number().positive().max(300).optional().nullable(),
  weightKg: z.coerce.number().positive().max(500).optional().nullable(),
  shirtSize: z.string().max(10).optional().nullable(),
  pantSize: z.string().max(10).optional().nullable(),
  shoeSize: z.string().max(10).optional().nullable(),
  issuedMobileNumber: z.string().regex(phoneRegex).max(20).optional().nullable(),
  mobileDeductionApplicable: z.boolean().default(false),
  canteenAllowanceApplicable: z.boolean().default(false),
  loanInstalmentMonth: z.string().max(20).optional().nullable(),
  personalEmail: z.string().email().max(100).optional().nullable(),
  ndaDocument: z.boolean().default(false),
  fitnessCertificate: z.boolean().default(false),
});

// ─── ContactDetails ──────────────────────────────────────────────────────────

export const contactDetailsSchema = z.object({
  permanentAddressLine1: z.string().max(200).optional().nullable(),
  permanentAddressLine2: z.string().max(200).optional().nullable(),
  permanentCity: z.string().max(100).optional().nullable(),
  permanentState: z.string().max(100).optional().nullable(),
  permanentPincode: z.string().regex(pincodeRegex).optional().nullable(),
  permanentMobile: z.string().regex(mobileRegex, 'Mobile No must be 10 digits or fewer').optional().nullable(),
  sameAsPermanent: z.boolean().default(false),
  presentAddressLine1: z.string().max(200).optional().nullable(),
  presentAddressLine2: z.string().max(200).optional().nullable(),
  presentCity: z.string().max(100).optional().nullable(),
  presentState: z.string().max(100).optional().nullable(),
  presentPincode: z.string().regex(pincodeRegex).optional().nullable(),
  presentMobile: z.string().regex(mobileRegex, 'Mobile No must be 10 digits or fewer').optional().nullable(),
});

// ─── Basic Details (Employee identity/classification + current JobInfo) ─────

export const basicDetailsSchema = z.object({
  // Employee fields
  companyId: z.number().int().positive(),
  title: z.string().max(10).optional().nullable(),
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100),
  employeeCode: z.string().min(1).max(20),
  oldEmployeeCode: z.string().max(20).optional().nullable(),
  status: z.string().max(20).default('active'),
  reportingManagerId: z.number().int().positive().optional().nullable(),
  profilePhotoPath: z.string().max(500).optional().nullable(),
  signaturePath: z.string().max(500).optional().nullable(),

  // Current JobInfo (classification + shift + employment)
  departmentId: z.number().int().positive(),
  subDepartmentId: z.number().int().positive().optional().nullable(),
  designationId: z.number().int().positive(),
  employeeTypeId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional().nullable(),
  subCategory: z.string().max(50).optional().nullable(),
  gradeId: z.number().int().positive().optional().nullable(),
  levelId: z.number().int().positive().optional().nullable(),
  unitId: z.number().int().positive().optional().nullable(),
  productionLine: z.string().max(100).optional().nullable(),
  additionalRole: z.string().max(100).optional().nullable(),
  teamGroup: z.string().max(100).optional().nullable(),
  joinDate: z.coerce.date(),
  // confirmationDate is set only by the Confirmation approval workflow
  // (POST /api/employees/[id]/confirmation/approve), never accepted here.
  // probationEndDate is server-computed from joinDate + probationPeriodMonths
  // (see calculateProbationEndDate) — also never accepted directly.
  probationPeriodMonths: z.number().int().min(0).max(60).optional().nullable(),
  shiftMasterId: z.number().int().positive().optional().nullable(),
  shiftPlanId: z.number().int().positive().optional().nullable(),
});

// ─── Job Profile (payroll config, official access, statutory, OT, resources) ─

export const jobProfileSchema = z.object({
  wageType: z.string().max(20).optional().nullable(),
  paymentMode: z.string().max(20).optional().nullable(),
  officialEmail: z.string().email().max(100).optional().nullable(),
  userId: z.number().int().positive().optional().nullable(), // linked login account
  petrolAllowance: z.boolean().default(false),
  esiApplicable: z.boolean().default(false),
  professionalTaxApplicable: z.boolean().default(false),
  bonusApplicable: z.boolean().default(false),
  ltaEligible: z.boolean().default(false),
  pfRestrictionAmount: z.coerce.number().nonnegative().optional().nullable(),
  overtimeAllowed: z.boolean().default(false),
  overtimeFactor: z.coerce.number().positive().max(10).optional().nullable(),
  overtimeRatePerHour: z.coerce.number().nonnegative().optional().nullable(),
  lossOfMinutesDeductionApplicable: z.boolean().default(false),
  allowedLossOfMinutes: z.number().int().nonnegative().optional().nullable(),
  numberOfLeavesAllowed: z.coerce.number().nonnegative().optional().nullable(),
  permissionRequestAllowed: z.boolean().default(false),
  permissionHours: z.coerce.number().nonnegative().optional().nullable(),
  companyContact1: z.string().regex(phoneRegex).max(20).optional().nullable(),
  companyContact2: z.string().regex(phoneRegex).max(20).optional().nullable(),
  ipAddress1: z.string().max(50).optional().nullable(),
  ipAddress2: z.string().max(50).optional().nullable(),
});

// ─── SalaryStructure ─────────────────────────────────────────────────────────

export const salaryStructureCreateSchema = z.object({
  basic: z.coerce.number().nonnegative(),
  hra: z.coerce.number().nonnegative(),
  conveyanceAllowance: z.coerce.number().nonnegative().default(0),
  medicalAllowance: z.coerce.number().nonnegative().default(0),
  specialAllowance: z.coerce.number().nonnegative().default(0),
  otherAllowance: z.coerce.number().nonnegative().default(0),
  pfApplicable: z.boolean().default(true),
  esiApplicable: z.boolean().default(false),
  monthlyCtc: z.coerce.number().nonnegative(),
  annualCtc: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date().default(() => new Date()),
});

// ─── BankDetail ──────────────────────────────────────────────────────────────

export const bankDetailSchema = z.object({
  bankName: z.string().max(100).optional().nullable(),
  branchName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(30).optional().nullable(),
  ifscCode: z.string().max(20).optional().nullable(),
  accountType: z.string().max(20).optional().nullable(),
  isPrimary: z.boolean().default(true),
});

// ─── Dependents ──────────────────────────────────────────────────────────────

export const dependentSchema = z.object({
  name: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50),
  dateOfBirth: z.coerce.date().optional().nullable(),
  isDependent: z.boolean().default(true),
});

// ─── Experience ──────────────────────────────────────────────────────────────

export const experienceSchema = z
  .object({
    companyName: z.string().min(1).max(100),
    designation: z.string().min(1).max(100),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date().optional().nullable(),
    reasonForLeaving: z.string().max(500).optional().nullable(),
    lastDrawnSalary: z.coerce.number().nonnegative().optional().nullable(),
  })
  .refine((data) => !data.toDate || data.toDate >= data.fromDate, {
    message: 'To Date cannot be earlier than From Date',
    path: ['toDate'],
  });

// ─── Education ───────────────────────────────────────────────────────────────

export const educationSchema = z.object({
  qualification: z.string().min(1).max(100),
  institution: z.string().max(200).optional().nullable(),
  university: z.string().max(200).optional().nullable(),
  yearOfPassing: z.number().int().min(1900).max(2100).optional().nullable(),
  percentage: z.coerce.number().min(0).max(100).optional().nullable(),
});

// ─── Emergency Contact ────────────────────────────────────────────────────────

export const emergencyContactSchema = z.object({
  contactName: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50),
  address: z.string().max(500).optional().nullable(),
  homePhone: z.string().regex(phoneRegex).max(20).optional().nullable(),
  mobile: z.string().regex(mobileRegex, 'Mobile must be 10 digits or fewer').optional().nullable(),
  alternatePhone: z.string().regex(phoneRegex).max(20).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Skill Matrix ──────────────────────────────────────────────────────────────

export const skillSchema = z.object({
  skillCategory: z.string().max(100).optional().nullable(),
  skillName: z.string().min(1).max(100),
  proficiencyLevel: z.string().max(30).optional().nullable(),
  levelPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  certified: z.boolean().default(false),
  certificateNumber: z.string().max(50).optional().nullable(),
  certifiedDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  evaluatedBy: z.string().max(100).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Passport ──────────────────────────────────────────────────────────────────

export const passportSchema = z
  .object({
    passportNumber: z.string().max(30).optional().nullable(),
    placeOfIssue: z.string().max(100).optional().nullable(),
    countryOfIssue: z.string().max(50).optional().nullable(),
    issueDate: z.coerce.date().optional().nullable(),
    expiryDate: z.coerce.date().optional().nullable(),
    filePath: z.string().max(500).optional().nullable(),
    verificationStatus: z.string().max(20).optional().nullable(),
  })
  .refine((data) => !data.issueDate || !data.expiryDate || data.expiryDate > data.issueDate, {
    message: 'Expiry Date must be later than Issue Date',
    path: ['expiryDate'],
  });

// ─── KYC & Statutory ─────────────────────────────────────────────────────────
// panNumber/aadhaarNumber/bankAccountNumber are accepted as PLAINTEXT here and
// encrypted server-side (src/lib/crypto.ts) before storage — never sent back
// to the client in full; see the KYC route for masking on read.

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadhaarRegex = /^[0-9]{12}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const kycSchema = z.object({
  pfNumber: z.string().max(30).optional().nullable(),
  uanNumber: z.string().max(20).optional().nullable(),
  esiNumber: z.string().max(20).optional().nullable(),
  // Accepts '' as "leave the stored value unchanged" — the GET route never
  // returns the real plaintext, so an untouched field round-trips as empty.
  panNumber: z.union([z.string().regex(panRegex, 'Invalid PAN format (e.g. ABCDE1234F)'), z.literal('')]).optional().nullable(),
  aadhaarNumber: z.union([z.string().regex(aadhaarRegex, 'Aadhaar must be 12 digits'), z.literal('')]).optional().nullable(),
  drivingLicenceNumber: z.string().max(30).optional().nullable(),
  drivingLicenceExpiry: z.coerce.date().optional().nullable(),
  electionCardNumber: z.string().max(30).optional().nullable(),
  rationCardNumber: z.string().max(30).optional().nullable(),
  verificationStatus: z.string().max(20).optional().nullable(),
  // Bank details — same authoritative-owner tab as the rest of KYC (spec §6.14).
  bankName: z.string().max(100).optional().nullable(),
  branchName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(30).optional().nullable(),
  ifscCode: z.string().regex(ifscRegex, 'Invalid IFSC format').optional().nullable(),
  accountType: z.string().max(20).optional().nullable(),
});

// ─── Asset Allocation ────────────────────────────────────────────────────────

export const assetAllocationSchema = z.object({
  assetMasterId: z.number().int().positive(),
  serialNumber: z.string().max(50).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  assetValue: z.coerce.number().nonnegative().optional().nullable(),
  allocatedDate: z.coerce.date().default(() => new Date()),
  expectedReturnDate: z.coerce.date().optional().nullable(),
  returnedDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ─── CTC ─────────────────────────────────────────────────────────────────────
// Manually configured values only — no PF/ESI/gratuity/CTC formulas invented.

export const ctcSchema = z.object({
  basic: z.coerce.number().nonnegative(),
  specialAllowance: z.coerce.number().nonnegative().default(0),
  hra: z.coerce.number().nonnegative().default(0),
  conveyanceAllowance: z.coerce.number().nonnegative().default(0),
  washAllowance: z.coerce.number().nonnegative().default(0),
  canteen: z.coerce.number().nonnegative().default(0),
  dislocationAllowance: z.coerce.number().nonnegative().default(0),
  otherAllowance: z.coerce.number().nonnegative().default(0),
  shiftAllowance: z.coerce.number().nonnegative().default(0),
  attendanceBonus: z.coerce.number().nonnegative().default(0),
  employeePf: z.coerce.number().nonnegative().default(0),
  employeeEsi: z.coerce.number().nonnegative().default(0),
  bonus: z.coerce.number().nonnegative().default(0),
  lta: z.coerce.number().nonnegative().default(0),
  medicalClaim: z.coerce.number().nonnegative().default(0),
  gratuity: z.coerce.number().nonnegative().default(0),
  employerPf: z.coerce.number().nonnegative().default(0),
  employerEsi: z.coerce.number().nonnegative().default(0),
  otherBenefits: z.coerce.number().nonnegative().default(0),
  nonMonetaryBenefits: z.coerce.number().nonnegative().default(0),
  monthlyCtc: z.coerce.number().nonnegative(),
  annualCtc: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
});

// ─── Salary Revision ─────────────────────────────────────────────────────────

export const salaryRevisionSchema = z.object({
  financialYear: z.string().max(10).optional().nullable(),
  grossSalary: z.coerce.number().nonnegative(),
  netSalary: z.coerce.number().nonnegative().optional().nullable(),
  effectiveFrom: z.coerce.date(),
  components: z
    .array(
      z.object({
        salaryComponentId: z.number().int().positive(),
        amount: z.coerce.number().nonnegative(),
      })
    )
    .default([]),
});

// ─── Employee core ───────────────────────────────────────────────────────────
// Create captures the 4 Phase-1 tabs in one shared shape (basicDetailsSchema
// is required — it's the minimum to create a valid Employee + current
// JobInfo row; the other three tabs are optional and can be completed later
// from the profile). Reused by both the Add Employee page and, eventually,
// per-tab PUT endpoints.

export const employeeCreateSchema = basicDetailsSchema.extend({
  personalDetails: personalDetailsSchema.optional(),
  contactDetails: contactDetailsSchema.optional(),
  jobProfile: jobProfileSchema.optional(),
  salaryStructure: salaryStructureCreateSchema.optional(),
  bankDetail: bankDetailSchema.optional(),
  dependents: z.array(dependentSchema).optional(),
  experiences: z.array(experienceSchema).optional(),
  educations: z.array(educationSchema).optional(),
});

export const employeeUpdateSchema = z.object({
  employeeCode: z.string().min(1).max(20).optional(),
  firstName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100).optional(),
  status: z.string().max(20).optional(),
  reportingManagerId: z.number().int().positive().optional().nullable(),
});

// ─── EmployeeDocument ─────────────────────────────────────────────────────────

export const documentCreateSchema = z.object({
  docType: z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'kpi', 'jd', 'other']),
  docNumber: z.string().max(50).optional().nullable(),
  fileName: z.string().max(200).optional().nullable(),
  filePath: z.string().max(500).optional().nullable(),
  issuedDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  isVerified: z.boolean().default(false),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
