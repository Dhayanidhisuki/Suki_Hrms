/**
 * Zod validation schemas for Employee Master CRUD.
 * Shared validation core — used by both API routes and client-side forms.
 */

import { z } from 'zod';

// ─── PersonalDetails ─────────────────────────────────────────────────────────

export const personalDetailsSchema = z.object({
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  maritalStatus: z.string().max(20).optional().nullable(),
  nationality: z.string().max(50).optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  physicallyChallenged: z.boolean().default(false),
  personalEmail: z.string().email().max(100).optional().nullable(),
  mobileNumber: z.string().max(20).optional().nullable(),
  alternatePhone: z.string().max(20).optional().nullable(),
  presentAddress: z.string().max(500).optional().nullable(),
  permanentAddress: z.string().max(500).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(20).optional().nullable(),
  emergencyContactRelation: z.string().max(50).optional().nullable(),
});

// ─── JobInfo ─────────────────────────────────────────────────────────────────

export const jobInfoCreateSchema = z.object({
  departmentId: z.number().int().positive(),
  subDepartmentId: z.number().int().positive().optional().nullable(),
  designationId: z.number().int().positive(),
  employeeTypeId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional().nullable(),
  gradeId: z.number().int().positive().optional().nullable(),
  levelId: z.number().int().positive().optional().nullable(),
  unitId: z.number().int().positive().optional().nullable(),
  shiftMasterId: z.number().int().positive().optional().nullable(),
  shiftPlanId: z.number().int().positive().optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  joinDate: z.coerce.date(),
  confirmationDate: z.coerce.date().optional().nullable(),
  probationEndDate: z.coerce.date().optional().nullable(),
  effectiveFrom: z.coerce.date().default(() => new Date()),
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

export const experienceSchema = z.object({
  companyName: z.string().min(1).max(100),
  designation: z.string().min(1).max(100),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date().optional().nullable(),
  reasonForLeaving: z.string().max(500).optional().nullable(),
  lastDrawnSalary: z.coerce.number().nonnegative().optional().nullable(),
});

// ─── Education ───────────────────────────────────────────────────────────────

export const educationSchema = z.object({
  qualification: z.string().min(1).max(100),
  institution: z.string().max(200).optional().nullable(),
  university: z.string().max(200).optional().nullable(),
  yearOfPassing: z.number().int().min(1900).max(2100).optional().nullable(),
  percentage: z.coerce.number().min(0).max(100).optional().nullable(),
});

// ─── Employee core ───────────────────────────────────────────────────────────

export const employeeCreateSchema = z.object({
  employeeCode: z.string().min(1).max(20),
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100),
  status: z.string().max(20).default('active'),
  reportingManagerId: z.number().int().positive().optional().nullable(),

  personalDetails: personalDetailsSchema.optional(),
  jobInfo: jobInfoCreateSchema.optional(),
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

// ─── Types ───────────────────────────────────────────────────────────────────

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
