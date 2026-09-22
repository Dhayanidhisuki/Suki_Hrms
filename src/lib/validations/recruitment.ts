/**
 * Zod validation schemas for Recruitment & Onboarding masters (BRD v6.4).
 * Shared between API routes and client forms.
 */

import { z } from 'zod';

function optionalNumber<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), inner.optional());
}

const optionalDecimal = (min: number, max: number) =>
  optionalNumber(z.coerce.number().min(min).max(max));

// ─── Simple masters (Pattern A + extra fields) ─────────────────────────────

export const recruitmentStatusSchema = z.object({
  statusCode: z.string().min(1).max(40),
  statusName: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  sequence: z.coerce.number().int().min(0),
  stageCategory: z.string().min(1).max(30),
  isTerminal: z.boolean().default(false),
  color: z.string().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const sourcingChannelSchema = z.object({
  channelCode: z.string().min(1).max(20),
  channelName: z.string().min(1).max(100),
  channelType: z.string().min(1).max(30),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const bgvStepSchema = z.object({
  stepCode: z.string().min(1).max(20),
  stepName: z.string().min(1).max(100),
  sequence: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});

export const slaConfigSchema = z.object({
  stageCode: z.string().min(1).max(40),
  stageName: z.string().min(1).max(100),
  slaDays: z.coerce.number().int().min(0),
  escalationRole: z.string().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const checklistMasterSchema = z.object({
  itemCode: z.string().min(1).max(20),
  itemName: z.string().min(1).max(200),
  sourceForm: z.string().max(100).optional().nullable(),
  mandatory: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const designationLevelSchema = z.object({
  levelCode: z.string().min(1).max(20),
  levelName: z.string().min(1).max(50),
  description: z.string().max(500).optional().nullable(),
  defaultApproverId: optionalNumber(z.coerce.number().int().positive()),
  isActive: z.boolean().default(true),
});

// ─── Interview configuration masters ────────────────────────────────────────

export const interviewTypeSchema = z.object({
  typeCode: z.string().min(1).max(20),
  typeName: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  mode: z.string().min(1).max(20),
  durationMins: optionalNumber(z.coerce.number().int().min(1)),
  evaluationRequired: z.boolean().default(true),
  scoreRequired: z.boolean().default(true),
  remarksRequired: z.boolean().default(true),
  interviewerRequired: z.boolean().default(true),
  meetingLinkRequired: z.boolean().default(false),
  locationRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const interviewLevelSchema = z.object({
  levelCode: z.string().min(1).max(20),
  levelName: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  sequenceNo: z.coerce.number().int().min(0),
  interviewTypeId: z.coerce.number().int().positive(),
  mandatory: z.boolean().default(true),
  minPassingScore: optionalDecimal(0, 100),
  maxAttempts: optionalNumber(z.coerce.number().int().min(1)),
  autoProgressNext: z.boolean().default(false),
  allowReinterview: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const interviewCriteriaSchema = z.object({
  criteriaCode: z.string().min(1).max(20),
  criteriaName: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  category: z.string().min(1).max(40),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  interviewTypeId: z.coerce.number().int().positive(),
  interviewLevelId: optionalNumber(z.coerce.number().int().positive()),
  scoreType: z.string().max(10).default('10'),
  minScore: optionalDecimal(0, 100),
  maxScore: optionalDecimal(0, 100),
  weightage: optionalDecimal(0, 100),
  mandatory: z.boolean().default(true),
  remarksRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const interviewScoreConfigSchema = z.object({
  configCode: z.string().min(1).max(20),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  interviewLevelId: z.coerce.number().int().positive(),
  interviewTypeId: z.coerce.number().int().positive(),
  criteriaId: z.coerce.number().int().positive(),
  maxScore: optionalDecimal(0, 100),
  minScore: optionalDecimal(0, 100),
  weightage: optionalDecimal(0, 100),
  passingScore: optionalDecimal(0, 100),
  ratingScale: z.string().max(10).default('10'),
  isActive: z.boolean().default(true),
});

export const interviewPanelSchema = z.object({
  panelCode: z.string().min(1).max(20),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  interviewLevelId: z.coerce.number().int().positive(),
  interviewTypeId: z.coerce.number().int().positive(),
  eligibleInterviewerId: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

export const interviewProcessSchema = z.object({
  processName: z.string().min(1).max(200),
  departmentId: z.coerce.number().int().positive(),
  designationId: z.coerce.number().int().positive(),
  employmentType: z.string().max(30).optional().nullable(),
  effectiveFrom: z.coerce.date().optional(),
  status: z.string().max(20).default('Active'),
  isActive: z.boolean().default(true),
});

// ─── Document & template masters ───────────────────────────────────────────

export const documentTypeSchema = z.object({
  documentCode: z.string().min(1).max(20),
  documentName: z.string().min(1).max(100),
  category: z.string().min(1).max(40),
  description: z.string().max(500).optional().nullable(),
  mandatory: z.boolean().default(false),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  employmentType: z.string().max(30).optional().nullable(),
  verificationRequired: z.boolean().default(true),
  allowedFileTypes: z.string().max(200).optional().nullable(),
  maxFileSizeMb: z.coerce.number().int().min(1).default(5),
  multipleFiles: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const emailTemplateSchema = z.object({
  templateCode: z.string().min(1).max(20),
  templateName: z.string().min(1).max(100),
  event: z.string().min(1).max(40),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  toRecipients: z.string().max(500).optional().nullable(),
  ccRecipients: z.string().max(500).optional().nullable(),
  bccRecipients: z.string().max(500).optional().nullable(),
  attachmentUrl: z.string().max(500).optional().nullable(),
  language: z.string().max(10).default('en'),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  isActive: z.boolean().default(true),
});

export const offerTemplateSchema = z.object({
  templateCode: z.string().min(1).max(20),
  templateName: z.string().min(1).max(100),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  employmentType: z.string().max(30).optional().nullable(),
  gradeId: optionalNumber(z.coerce.number().int().positive()),
  locationId: optionalNumber(z.coerce.number().int().positive()),
  version: z.string().max(20).default('1.0'),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Approval matrices ─────────────────────────────────────────────────────

export const recruitmentApprovalMatrixSchema = z.object({
  matrixCode: z.string().min(1).max(20),
  process: z.string().min(1).max(30),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  employmentType: z.string().max(30).optional().nullable(),
  minSalary: optionalDecimal(0, 999999999),
  maxSalary: optionalDecimal(0, 999999999),
  approvalLevel: z.coerce.number().int().min(1),
  approverType: z.string().min(1).max(30),
  approverId: optionalNumber(z.coerce.number().int().positive()),
  mandatory: z.boolean().default(true),
  sequence: z.coerce.number().int().min(0),
  escalationDays: optionalNumber(z.coerce.number().int().min(1)),
  isActive: z.boolean().default(true),
});

export const joiningApprovalMatrixSchema = z.object({
  matrixCode: z.string().min(1).max(20),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationLevelId: z.coerce.number().int().positive(),
  approvalLevel: z.coerce.number().int().min(1),
  approverId: z.coerce.number().int().positive(),
  approverRole: z.string().max(100).optional().nullable(),
  mandatory: z.boolean().default(true),
  sequence: z.coerce.number().int().min(0),
  escalationDays: optionalNumber(z.coerce.number().int().min(1)),
  isActive: z.boolean().default(true),
});

// ─── Employee ID config ─────────────────────────────────────────────────────

export const employeeIdConfigSchema = z.object({
  prefix: z.string().min(1).max(10).default('KUN'),
  includeYear: z.boolean().default(true),
  includeDepartment: z.boolean().default(false),
  sequenceLength: z.coerce.number().int().min(1).max(10).default(4),
  separator: z.string().max(5).default('-'),
  startNumber: z.coerce.number().int().min(0).default(1),
});

// ─── Internship policy ──────────────────────────────────────────────────────

export const internshipPolicySchema = z.object({
  policyCode: z.string().min(1).max(20),
  policyName: z.string().min(1).max(100),
  stipendApplicable: z.boolean().default(false),
  defaultStipendAmount: optionalDecimal(0, 999999999),
  stipendFrequency: z.string().max(20).optional().nullable(),
  allowancesApplicable: z.boolean().default(false),
  allowanceComponents: z.string().optional().nullable(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

// ─── Candidate (BRD §5.3) ───────────────────────────────────────────────────

export const candidateCreateSchema = z.object({
  title: z.string().max(10).optional().nullable(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  mobile: z.string().trim().min(1).max(20),
  email: z.string().trim().min(1).max(100).email(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  aadhaar: z.string().max(20).optional().nullable(),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  jobPostingId: optionalNumber(z.coerce.number().int().positive()),
  sourceChannelId: optionalNumber(z.coerce.number().int().positive()),
  referenceComments: z.string().max(500).optional().nullable(),
  acknowledgeDuplicate: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
});

export const candidateUpdateSchema = z.object({
  title: z.string().max(10).optional().nullable(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  mobile: z.string().trim().min(1).max(20).optional(),
  email: z.string().trim().min(1).max(100).email().optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  aadhaar: z.string().max(20).optional().nullable(),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  jobPostingId: optionalNumber(z.coerce.number().int().positive()),
  sourceChannelId: optionalNumber(z.coerce.number().int().positive()),
  referenceComments: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const candidateStatusUpdateSchema = z.object({
  statusId: z.coerce.number().int().positive(),
  remarks: z.string().max(2000).optional().nullable(),
});

// ─── Call Interview (BRD §5.4) ──────────────────────────────────────────────

export const callInterviewCreateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  recruiterId: optionalNumber(z.coerce.number().int().positive()),
  callDate: z.coerce.date(),
  callTime: z.string().max(10).optional().nullable(),
  callOutcome: z.string().min(1).max(40),
  candidateInterested: z.boolean().default(false),
  expectedSalary: optionalDecimal(0, 999999999),
  noticePeriod: z.string().max(100).optional().nullable(),
  availableJoiningDate: z.coerce.date().optional().nullable(),
  remarks: z.string().optional().nullable(),
  nextAction: z.string().max(200).optional().nullable(),
});

// ─── Interview Scheduling (BRD §5.7, §5.9) ─────────────────────────────────

export const interviewScheduleCreateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  interviewLevelId: z.coerce.number().int().positive(),
  interviewTypeId: z.coerce.number().int().positive(),
  interviewerId: z.coerce.number().int().positive(),
  scheduledDate: z.coerce.date(),
  startTime: z.string().min(1).max(10),
  endTime: z.string().max(10).optional().nullable(),
  mode: z.string().min(1).max(20),
  locationOrLink: z.string().max(500).optional().nullable(),
});

export const interviewScheduleUpdateSchema = z.object({
  scheduledDate: z.coerce.date().optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional().nullable(),
  mode: z.string().max(20).optional(),
  locationOrLink: z.string().max(500).optional().nullable(),
  status: z.string().max(20).optional(),
});

// ─── Interview Evaluation (BRD §5.11, §5.12) ────────────────────────────────

export const interviewEvaluationSchema = z.object({
  criteriaId: z.coerce.number().int().positive(),
  score: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(0).max(100).default(10),
  remarks: z.string().optional().nullable(),
});

export const evaluationSubmitSchema = z.object({
  evaluations: z.array(interviewEvaluationSchema),
  recommendation: z.string().max(40).optional().nullable(),
  strengths: z.string().optional().nullable(),
  weaknesses: z.string().optional().nullable(),
  finalRemarks: z.string().optional().nullable(),
});

// ─── Candidate Document (BRD §5.13) ───────────────────────────────────────

export const candidateDocumentVerifySchema = z.object({
  status: z.string().min(1).max(20), // Verified | Rejected | Re-upload
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Final Selection (BRD §5.14) ───────────────────────────────────────────
// No separate model — stored as Draft OfferLetter with proposed salary/joining.

export const finalSelectionSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  proposedSalary: z.coerce.number().min(0),
  joiningDate: z.coerce.date(),
  employmentType: z.string().min(1).max(40),
  reportingManagerId: optionalNumber(z.coerce.number().int().positive()),
  remarks: z.string().max(2000).optional().nullable(),
});

// ─── Offer Letter (BRD §5.15) ──────────────────────────────────────────────

export const offerLetterCreateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  offerTemplateId: optionalNumber(z.coerce.number().int().positive()),
  proposedSalary: z.coerce.number().min(0),
  joiningDate: z.coerce.date(),
  employmentType: z.string().min(1).max(40),
  reportingManagerId: optionalNumber(z.coerce.number().int().positive()),
  locationId: optionalNumber(z.coerce.number().int().positive()),
  probationMonths: z.coerce.number().int().min(0).max(24).default(6),
  remarks: z.string().max(2000).optional().nullable(),
});

export const offerLetterStatusSchema = z.object({
  status: z.string().min(1).max(20), // Draft | Generated | Sent | Accepted | Rejected | Expired | Closed
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Appointment Order (BRD §6.1) ─────────────────────────────────────────

export const appointmentOrderCreateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  offerLetterId: optionalNumber(z.coerce.number().int().positive()),
});

export const appointmentStatusSchema = z.object({
  status: z.string().min(1).max(20), // Draft | Generated | Sent | Accepted | Declined | Expired | Closed
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Candidate Joining (BRD §5.16) ─────────────────────────────────────────

export const candidateJoiningCreateSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  offerLetterId: optionalNumber(z.coerce.number().int().positive()),
  joiningDate: z.coerce.date().optional().nullable(),
  actualJoiningDate: z.coerce.date().optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
});

export const candidateJoiningUpdateSchema = z.object({
  joiningDate: z.coerce.date().optional().nullable(),
  actualJoiningDate: z.coerce.date().optional().nullable(),
  joiningStatus: z.string().max(30).optional(),
  approvalStatus: z.string().max(20).optional(),
  approverId: optionalNumber(z.coerce.number().int().positive()),
  approvalRemarks: z.string().max(2000).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
});

// ─── Checklist Item Update (BRD §7.1) ─────────────────────────────────────

export const checklistItemUpdateSchema = z.object({
  status: z.string().min(1).max(20), // Received | Not Received | Not Required
});

// ─── Joining Approval (BRD §8) ─────────────────────────────────────────────

export const joiningApprovalSchema = z.object({
  action: z.string().min(1).max(20), // Approved | Rejected | Hold
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Push to Employee (BRD §5.17, §9) ──────────────────────────────────────

export const pushToEmployeeSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  joiningId: z.coerce.number().int().positive(),
  companyId: z.coerce.number().int().positive(),
  employeeCode: z.string().optional(), // auto-generated if not provided
});

// ─── Statutory Forms (BRD §7.2-7.7) ───────────────────────────────────────

// Joining Form (§7.2) — 19 fields
export const joiningFormSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  postApplied: z.string().min(1).max(200),
  applicantName: z.string().min(1).max(200),
  fatherName: z.string().max(200).optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  age: z.coerce.number().int().min(0).max(150).optional().nullable(),
  gender: z.string().max(10).optional().nullable(),
  nationality: z.string().max(50).optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  communicationAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  experience: z.string().optional().nullable(),
  languages: z.string().max(500).optional().nullable(),
  educationalQualification: z.string().optional().nullable(),
  technicalQualification: z.string().max(500).optional().nullable(),
  maritalStatus: z.string().max(20).optional().nullable(),
  email: z.string().max(100).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
});

// Joining Report (§7.3)
export const joiningReportSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  joiningDate: z.coerce.date(),
  locationId: optionalNumber(z.coerce.number().int().positive()),
  grade: z.string().max(20).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  reportedTo: z.string().max(200).optional().nullable(),
  panNo: z.string().max(20).optional().nullable(),
  presentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  contactNumber: z.string().min(1).max(20),
  emergencyContact: z.string().max(200).optional().nullable(),
  certificatesVerifiedBy: z.string().max(200).optional().nullable(),
});

// Gratuity Nomination (§7.4) — with nominees
export const gratuityNomineeSchema = z.object({
  nomineeName: z.string().min(1).max(200),
  relationship: z.string().min(1).max(50),
  age: z.coerce.number().int().min(0).max(150).optional().nullable(),
  proportion: optionalDecimal(0, 100),
});

export const gratuityNominationSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  employeeName: z.string().min(1).max(200),
  employerRefNo: z.string().max(40).optional().nullable(),
  sex: z.string().max(10).optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  maritalStatus: z.string().max(20).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  postHeld: z.string().max(100).optional().nullable(),
  appointmentDate: z.coerce.date().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  nominees: z.array(gratuityNomineeSchema).default([]),
});

// PF Nomination (§7.5) — with nominees
export const pfNomineeSchema = z.object({
  nomineeName: z.string().min(1).max(200),
  relationship: z.string().min(1).max(50),
  age: z.coerce.number().int().min(0).max(150).optional().nullable(),
  proportion: optionalDecimal(0, 100),
});

export const pfNominationSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  employeeName: z.string().min(1).max(200),
  aadhaar: z.string().max(20).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
  uan: z.string().max(20).optional().nullable(),
  nominees: z.array(pfNomineeSchema).default([]),
});

// ESI Application (§7.6)
export const esiApplicationSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  applicable: z.boolean().default(true),
  ipNumber: z.string().max(40).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
  dateOfJoining: z.coerce.date().optional().nullable(),
  aadhaar: z.string().max(20).optional().nullable(),
  aadhaarMobile: z.string().max(20).optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  presentAddress: z.string().optional().nullable(),
  nomineeDetails: z.string().optional().nullable(),
  bankIfsc: z.string().max(20).optional().nullable(),
  bankAccount: z.string().max(30).optional().nullable(),
  reasonIfNotApplicable: z.string().max(500).optional().nullable(),
});

// Insurance Form (§7.7)
export const insuranceFormSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  employeeName: z.string().min(1).max(200),
  employeeId: optionalNumber(z.coerce.number().int().positive()),
  policyNo: z.string().min(1).max(50),
  provider: z.string().min(1).max(200),
  coverageType: z.string().min(1).max(50),
  coverageAmount: optionalDecimal(0, 999999999),
  premiumAmount: optionalDecimal(0, 999999999),
  nomineeName: z.string().min(1).max(200),
  nomineeRelationship: z.string().max(50).optional().nullable(),
  nomineeAge: z.coerce.number().int().min(0).max(150).optional().nullable(),
  nomineeAddress: z.string().optional().nullable(),
  dependentsCovered: z.string().optional().nullable(),
  employeeSignatureUrl: z.string().max(500).optional().nullable(),
  hrVerificationUrl: z.string().max(500).optional().nullable(),
  status: z.string().max(20).optional().default('Pending'),
});

// ─── Internship (BRD §6.2) ─────────────────────────────────────────────────

export const internshipSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  college: z.string().max(200).optional().nullable(),
  regNo: z.string().max(50).optional().nullable(),
  course: z.string().max(200).optional().nullable(),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  mentorId: optionalNumber(z.coerce.number().int().positive()),
  trainingStart: z.coerce.date(),
  trainingEnd: z.coerce.date(),
  stipend: optionalDecimal(0, 999999999),
  policyId: optionalNumber(z.coerce.number().int().positive()),
});

export const internshipStatusSchema = z.object({
  status: z.string().min(1).max(20), // Applied | Accepted | Active | Completed | Terminated | Converted | Closed
  remarks: z.string().max(500).optional().nullable(),
});

// ─── BGV (BRD §10.3) ───────────────────────────────────────────────────────

export const candidateBgvSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  bgvStepId: z.coerce.number().int().positive(),
  status: z.string().min(1).max(20),
  contactName: z.string().max(100).optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  performedAt: z.coerce.date().optional().nullable(),
  outcome: z.string().max(500).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// ─── Communication Log (BRD §5.5, §5.21) ────────────────────────────────────

export const communicationLogSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  emailTemplateId: optionalNumber(z.coerce.number().int().positive()),
  eventType: z.string().min(1).max(40),
  toEmail: z.string().email().max(100),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  status: z.string().max(20).default('Sent'),
});

// ─── Appointment Template (BRD §12.7 — P1) ────────────────────────────────

export const appointmentTemplateSchema = z.object({
  templateCode: z.string().min(1).max(20),
  templateName: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  employmentType: z.string().max(30).optional().nullable(),
  version: z.string().max(20).default('1.0'),
});

// ─── Other Joining Doc Type Master (BRD §7.8) ─────────────────────────────

export const otherJoiningDocTypeSchema = z.object({
  docCode: z.string().min(1).max(20),
  docName: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  mandatory: z.boolean().default(false),
});

// ─── Candidate Other Document (BRD §7.8) ───────────────────────────────────

export const candidateOtherDocumentSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
  otherDocTypeId: z.coerce.number().int().positive(),
  documentName: z.string().min(1).max(200),
  fileName: z.string().max(200).optional().nullable(),
  filePath: z.string().max(500).optional().nullable(),
  verificationStatus: z.string().max(20).default('Pending'),
  remarks: z.string().max(500).optional().nullable(),
});

// ─── Candidate Portal (BRD §10.6) ──────────────────────────────────────────

export const portalMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  fromName: z.string().min(1).max(200).optional(),
});

export const portalDocumentUploadSchema = z.object({
  documentName: z.string().min(1).max(200),
  fileName: z.string().max(200).optional().nullable(),
  filePath: z.string().max(500).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});
