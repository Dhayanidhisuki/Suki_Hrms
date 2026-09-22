import { z } from 'zod';

export const skillLevelSchema = z.object({
  levelNumber: z.coerce.number().int().min(1).max(20),
  name: z.string().min(1).max(50),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(7).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const competencySchema = z.object({
  code: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  type: z.string().max(50).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const competencyRequirementSchema = z.object({
  competencyId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  designationId: z.coerce.number().int().positive().nullable().optional(),
  gradeId: z.coerce.number().int().positive().nullable().optional(),
  jobRole: z.string().max(100).nullable().optional(),
  requiredLevelId: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

export const skillMatrixUpdateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  competencyId: z.coerce.number().int().positive(), // competency OR skill id, per itemType
  itemType: z.enum(['COMPETENCY', 'SKILL']).default('COMPETENCY'),
  currentLevelId: z.coerce.number().int().positive(),
  targetLevelId: z.coerce.number().int().positive().nullable().optional(),
});

export const trainingPlanSchema = z.object({
  year: z.string().min(1).max(9),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  totalEstimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  totalApprovedBudget: z.coerce.number().nonnegative().nullable().optional(),
  status: z.string().max(20).default('DRAFT'),
});

export const trainingPlanLineSchema = z.object({
  trainingPlanId: z.coerce.number().int().positive(),
  plannedMonth: z.coerce.number().int().min(1).max(12),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive(),
  trainerId: z.coerce.number().int().positive().nullable().optional(),
  trainingMethod: z.string().max(50).nullable().optional(),
  participantCount: z.coerce.number().int().nonnegative().nullable().optional(),
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  priority: z.string().max(20).default('MEDIUM'),
  isMandatory: z.boolean().default(false),
  status: z.string().max(20).default('DRAFT'),
  // Annual training calendar fields (reference Excel format).
  traineeCategory: z.enum(['STAFF', 'WORKER']).nullable().optional(),
  mentorType: z.enum(['INTERNAL', 'EXTERNAL']).nullable().optional(),
  mentorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  externalMentorName: z.string().max(150).nullable().optional(),
  trainerType: z.string().max(100).nullable().optional(),
  targetDepartments: z.string().max(500).nullable().optional(),
  schedulePeriod: z.enum(['QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'MONTH_WISE']).nullable().optional(),
  monthFrom: z.coerce.number().int().min(1).max(12).nullable().optional(),
  monthTo: z.coerce.number().int().min(1).max(12).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  postponedTo: z.coerce.date().nullable().optional(),
});

export const trainingScheduleSchema = z.object({
  trainingPlanLineId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive(),
  title: z.string().max(200).nullable().optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
  startTime: z.string().max(8).nullable().optional(),
  endTime: z.string().max(8).nullable().optional(),
  duration: z.coerce.number().nonnegative().nullable().optional(),
  method: z.string().max(50).nullable().optional(),
  venueId: z.coerce.number().int().positive().nullable().optional(),
  meetingLink: z.string().max(500).nullable().optional(),
  trainerId: z.coerce.number().int().positive().nullable().optional(),
  coTrainerId: z.coerce.number().int().positive().nullable().optional(),
  coordinator: z.string().max(100).nullable().optional(),
  maxParticipants: z.coerce.number().int().nonnegative().nullable().optional(),
  minParticipants: z.coerce.number().int().nonnegative().nullable().optional(),
  targetDepartmentId: z.coerce.number().int().positive().nullable().optional(),
  targetGradeId: z.coerce.number().int().positive().nullable().optional(),
  targetEmployeeIds: z.string().max(1000).nullable().optional(),
  mentorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  // §17: schedule-level mentor details (TrainingMentor master link + window).
  mentorId: z.coerce.number().int().positive().nullable().optional(),
  mentorRole: z.string().max(100).nullable().optional(),
  mentorStartDate: z.coerce.date().nullable().optional(),
  mentorEndDate: z.coerce.date().nullable().optional(),
  mentorOutcome: z.string().max(300).nullable().optional(),
  // §19: booked resources — JSON array of TrainingResource ids.
  resourceIds: z.string().nullable().optional(),
  materials: z.string().max(500).nullable().optional(),
  assessmentRequired: z.boolean().default(false),
  feedbackRequired: z.boolean().default(false),
  certificationRequired: z.boolean().default(false),
  checklistId: z.coerce.number().int().positive().nullable().optional(),
  status: z.string().max(20).default('PENDING'),
});

// §15 Monthly Training Plan — header + lines managed together.
export const monthlyPlanLineSchema = z.object({
  trainingProgramId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  employeeGroup: z.string().max(100).nullable().optional(),
  participantCount: z.coerce.number().int().nonnegative().nullable().optional(),
  trainerId: z.coerce.number().int().positive().nullable().optional(),
  mentorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  plannedDate: z.coerce.date().nullable().optional(),
  duration: z.coerce.number().nonnegative().nullable().optional(),
  durationUnit: z.string().max(20).nullable().optional(),
  venueId: z.coerce.number().int().positive().nullable().optional(),
  method: z.string().max(50).nullable().optional(),
  budget: z.coerce.number().nonnegative().nullable().optional(),
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  status: z.string().max(20).default('PLANNED'),
});

export const monthlyPlanSchema = z.object({
  trainingPlanId: z.coerce.number().int().positive().nullable().optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  lines: z.array(monthlyPlanLineSchema).default([]),
  generateFromAnnual: z.boolean().default(false),
});

// §34 Training cost components.
export const COST_HEADS = [
  'TRAINER_FEE', 'VENUE', 'TRAVEL', 'ACCOMMODATION', 'MATERIAL',
  'CERTIFICATION', 'SOFTWARE', 'FOOD', 'EMPLOYEE_TRAVEL', 'OTHER',
] as const;

export const trainingCostItemSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive().nullable().optional(),
  externalTrainingId: z.coerce.number().int().positive().nullable().optional(),
  head: z.enum(COST_HEADS),
  amount: z.coerce.number().positive(),
  description: z.string().max(300).nullable().optional(),
});

// ── Phase 1: closed-loop lifecycle ──────────────────────────────────────────

// §8: validated TNA source options — all BRD sources plus legacy values used in seed/ESS.
export const TNA_SOURCES = [
  'SKILL_GAP', 'COMPETENCY_GAP', 'PERFORMANCE', 'MANAGER_RECOMMENDATION',
  'EMPLOYEE_REQUEST', 'MANDATORY', 'NEW_JOINING', 'PROMOTION', 'TRANSFER',
  'BUSINESS_REQUIREMENT', 'CAREER_DEVELOPMENT', 'AUDIT_FINDING',
  'CUSTOMER_REQUIREMENT', 'LEGAL_REGULATORY', 'SUCCESSION_PLANNING', 'REFRESHER',
  // legacy values kept for backward compatibility
  'EMPLOYEE', 'GAP', 'MANAGER', 'SYSTEM', 'OTHER',
] as const;

export const trainingNeedSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  source: z.enum(TNA_SOURCES).default('SKILL_GAP'),
  reason: z.string().max(500).nullable().optional(),
  priority: z.string().max(20).default('MEDIUM'),
  status: z.string().max(20).default('DRAFT'),
  tnaReference: z.string().max(100).nullable().optional(),
  // §7.2 extended TNA attributes.
  tnaYear: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  skillId: z.coerce.number().int().positive().nullable().optional(),
  currentLevelId: z.coerce.number().int().positive().nullable().optional(),
  requiredLevelId: z.coerce.number().int().positive().nullable().optional(),
  gapLevel: z.string().max(20).nullable().optional(),
  businessImpact: z.string().max(500).nullable().optional(),
  isMandatory: z.boolean().default(false),
  proposedMethod: z.string().max(50).nullable().optional(),
  proposedTrainer: z.string().max(100).nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  managerRemarks: z.string().max(500).nullable().optional(),
});

export const trainingNominationSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  managerEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().max(200).nullable().optional(),
  priority: z.string().max(20).default('MEDIUM'),
  status: z.string().max(20).default('PENDING'),
});

export const trainingAttendanceSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  status: z.string().max(20).default('ABSENT'),
  attendedDuration: z.coerce.number().nonnegative().nullable().optional(),
  scheduledDuration: z.coerce.number().nonnegative().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

export const trainingAttendanceBulkSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive(),
  rows: z.array(z.object({
    employeeId: z.coerce.number().int().positive(),
    status: z.string().max(20).default('ABSENT'),
    attendedDuration: z.coerce.number().nonnegative().nullable().optional(),
    scheduledDuration: z.coerce.number().nonnegative().nullable().optional(),
    remarks: z.string().max(500).nullable().optional(),
  })).min(1),
});

export const trainingFeedbackSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive().nullable().optional(),
  trainerRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  contentRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  venueRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  overallRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  materialRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  durationRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  relevanceRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  learningOutcomeRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  comments: z.string().max(1000).nullable().optional(),
});

// ── Phase 3: Assessment & Effectiveness (BRD §24–28) ─────────────────────────

export const questionBankGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  passMark: z.coerce.number().int().min(0).max(100).nullable().optional(),
  durationMinutes: z.coerce.number().int().positive().nullable().optional(),
  randomQuestions: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  gradeId: z.coerce.number().int().positive().nullable().optional(),
  // §25: additional group links — skill, proficiency level, program.
  skillId: z.coerce.number().int().positive().nullable().optional(),
  proficiencyLevelId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const questionBankSchema = z.object({
  groupId: z.coerce.number().int().positive().nullable().optional(),
  question: z.string().min(1).max(1000),
  questionType: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'RATING', 'MULTI_SELECT', 'DESCRIPTIVE', 'SCENARIO', 'PRACTICAL', 'FILL_BLANK']).default('MCQ'),
  options: z.string().nullable().optional(), // JSON array for MCQ/MULTI_SELECT
  correctAnswer: z.string().max(500).nullable().optional(),
  maxScore: z.coerce.number().int().min(1).default(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
  explanation: z.string().max(1000).nullable().optional(),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  skillId: z.coerce.number().int().positive().nullable().optional(),
  proficiencyLevelId: z.coerce.number().int().positive().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const assessmentSchema = z.object({
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  trainingScheduleId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  assessmentType: z.enum(['PRE', 'POST', 'PERIODIC', 'CERTIFICATION']).default('POST'),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  durationMinutes: z.coerce.number().int().positive().nullable().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  questionIds: z.string().nullable().optional(), // JSON array
  promoteOnPass: z.boolean().default(false),
  promoteToLevelId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const assessmentAttemptSchema = z.object({
  assessmentId: z.coerce.number().int().positive(),
  // Optional: ESS callers omit it and the route resolves their own employee.
  employeeId: z.coerce.number().int().positive().optional(),
  answersJson: z.string().nullable().optional(), // JSON: [{questionId, answer, score}]
  startedAt: z.coerce.date().nullable().optional(), // client-supplied start for timeTaken
});

export const trainingEffectivenessSchema = z.object({
  trainingScheduleId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  preScore: z.coerce.number().int().min(0).max(100).nullable().optional(),
  postScore: z.coerce.number().int().min(0).max(100).nullable().optional(),
  level1Reaction: z.coerce.number().int().min(1).max(5).nullable().optional(),
  level2Learning: z.coerce.number().int().min(0).max(100).nullable().optional(),
  level3Behavior: z.coerce.number().int().min(1).max(5).nullable().optional(),
  level4Results: z.coerce.number().int().min(1).max(5).nullable().optional(),
  effectivenessRating: z.string().max(20).nullable().optional(),
  evaluationStage: z.enum(['IMMEDIATE', 'D30', 'D60', 'D90']).nullable().optional(),
  applicationOfLearning: z.coerce.number().int().min(1).max(5).nullable().optional(),
  behavioralChange: z.coerce.number().int().min(1).max(5).nullable().optional(),
  skillImprovement: z.coerce.number().int().min(1).max(5).nullable().optional(),
  productivityImprovement: z.coerce.number().int().min(1).max(5).nullable().optional(),
  qualityImprovement: z.coerce.number().int().min(1).max(5).nullable().optional(),
  additionalTrainingRequired: z.boolean().default(false),
  trainingOutcome: z.string().max(500).nullable().optional(),
  roiImpact: z.string().max(500).nullable().optional(),
  recommendation: z.string().max(500).nullable().optional(),
  followUpRequired: z.boolean().default(false),
  evaluationDate: z.coerce.date().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

// ── Phase 5a: Masters (BRD §9–12, §16–19) ────────────────────────────────────

export const trainingProgramSchema = z.object({
  code: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(100),
  category: z.string().max(50).nullable().optional(),
  type: z.string().max(50).nullable().optional(),
  objective: z.string().max(500).nullable().optional(),
  learningOutcome: z.string().max(500).nullable().optional(),
  targetAudience: z.string().max(200).nullable().optional(),
  method: z.string().max(50).nullable().optional(),
  duration: z.coerce.number().nonnegative().nullable().optional(),
  durationUnit: z.string().max(20).default('HOURS'),
  assessmentRequired: z.boolean().default(false),
  certificationRequired: z.boolean().default(false),
  validityMonths: z.coerce.number().int().positive().nullable().optional(),
  refresherFrequency: z.string().max(50).nullable().optional(),
  estimatedCost: z.coerce.number().nonnegative().nullable().optional(),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  skillId: z.coerce.number().int().positive().nullable().optional(),
  isMandatory: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const trainerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(100).nullable().optional().or(z.literal('')),
  phone: z.string().max(20).nullable().optional(),
  isExternal: z.boolean().default(false),
  vendor: z.string().max(100).nullable().optional(),
  commercialRate: z.coerce.number().nonnegative().nullable().optional(),
  contractDetails: z.string().max(500).nullable().optional(),
  employeeId: z.coerce.number().int().positive().nullable().optional(),
  expertise: z.string().max(300).nullable().optional(),
  certifications: z.string().max(500).nullable().optional(),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  experienceYears: z.coerce.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const trainingVenueSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  floor: z.string().max(50).nullable().optional(),
  building: z.string().max(100).nullable().optional(),
  equipment: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

// ── Phase 5b/c: Policy, Budget, Induction, OJT, Checklist, Certificate ───────

export const trainingPolicySchema = z.object({
  name: z.string().min(1).max(200),
  minAttendancePercent: z.coerce.number().int().min(0).max(100).nullable().optional(),
  assessmentRequired: z.boolean().default(false),
  feedbackRequired: z.boolean().default(true),
  nominationCutoffDays: z.coerce.number().int().nonnegative().nullable().optional(),
  externalBudgetCap: z.coerce.number().nonnegative().nullable().optional(),
  mandatoryTrainingGraceDays: z.coerce.number().int().nonnegative().nullable().optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  policyNumber: z.string().max(30).nullable().optional(),
  version: z.string().max(20).nullable().optional(),
  applicableDepartmentId: z.coerce.number().int().positive().nullable().optional(),
  applicableLocationId: z.coerce.number().int().positive().nullable().optional(),
  applicableGroup: z.string().max(100).nullable().optional(),
  approvalStatus: z.string().max(20).default('DRAFT'),
  attachmentPath: z.string().max(500).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  reimbursementRules: z.string().max(500).nullable().optional(),
  cancellationRules: z.string().max(500).nullable().optional(),
  minTrainingHoursPerYear: z.coerce.number().int().nonnegative().nullable().optional(),
  employeeObligations: z.string().max(500).nullable().optional(),
  // §13 remaining policy rule texts.
  eligibilityRules: z.string().max(500).nullable().optional(),
  nominationRules: z.string().max(500).nullable().optional(),
  approvalHierarchy: z.string().max(500).nullable().optional(),
  externalTrainingRules: z.string().max(500).nullable().optional(),
  costPolicyRules: z.string().max(500).nullable().optional(),
  certificationRules: z.string().max(500).nullable().optional(),
  attendanceRules: z.string().max(500).nullable().optional(),
  effectivenessRules: z.string().max(500).nullable().optional(),
  validityRules: z.string().max(500).nullable().optional(),
  refresherRules: z.string().max(500).nullable().optional(),
  managerResponsibilities: z.string().max(500).nullable().optional(),
  hrResponsibilities: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const trainingBudgetSchema = z.object({
  year: z.string().min(4).max(9),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  locationId: z.coerce.number().int().positive().nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  allocatedAmount: z.coerce.number().nonnegative(),
  approvedAmount: z.coerce.number().nonnegative().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const inductionProgramSchema = z.object({
  name: z.string().min(1).max(200),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  designationId: z.coerce.number().int().positive().nullable().optional(),
  locationId: z.coerce.number().int().positive().nullable().optional(),
  durationDays: z.coerce.number().int().positive().nullable().optional(),
  topicsJson: z.string().nullable().optional(), // JSON [{topic, trainer, day}]
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const inductionAssignmentSchema = z.object({
  inductionProgramId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  targetDate: z.coerce.date().nullable().optional(),
  checklistJson: z.string().nullable().optional(), // JSON [{topic, done, date}]
  employeeConfirmed: z.boolean().optional(),
  status: z.string().max(20).default('PENDING'),
});

export const ojtAssignmentSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  mentorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  trainerId: z.coerce.number().int().positive().nullable().optional(),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  checklistId: z.coerce.number().int().positive().nullable().optional(),
  skillsCovered: z.string().max(500).nullable().optional(),
  observation: z.string().max(1000).nullable().optional(),
  assessmentId: z.coerce.number().int().positive().nullable().optional(), // §43 linked assessment
  assessmentScore: z.coerce.number().min(0).nullable().optional(),
  status: z.string().max(20).default('IN_PROGRESS'),
  remarks: z.string().max(500).nullable().optional(),
});

export const trainingChecklistSchema = z.object({
  name: z.string().min(1).max(200),
  checklistType: z.string().max(30).default('GENERAL'),
  items: z.array(z.object({
    label: z.string().min(1).max(300),
    sortOrder: z.coerce.number().int().default(0),
    isMandatory: z.boolean().default(false),
  })).default([]),
});

export const trainingCertificateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  trainingScheduleId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  certificateNumber: z.string().max(50).nullable().optional(),
  issueDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  filePath: z.string().max(500).nullable().optional(),
});

// ── Phase 7: Skill master chain (BRD §29, §47) ───────────────────────────────

export const skillSchema = z.object({
  code: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(100),
  category: z.string().max(50).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const skillRequirementSchema = z.object({
  skillId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  designationId: z.coerce.number().int().positive().nullable().optional(),
  gradeId: z.coerce.number().int().positive().nullable().optional(),
  jobRole: z.string().max(100).nullable().optional(),
  requiredLevelId: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

// §35: participant record on an external training.
export const externalParticipantSchema = z.object({
  externalTrainingId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
  status: z.enum(['NOMINATED', 'COMPLETED', 'CANCELLED']).default('NOMINATED'),
  certificateId: z.coerce.number().int().positive().nullable().optional(),
  feedbackRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  feedbackComments: z.string().max(1000).nullable().optional(),
  effectivenessRating: z.enum(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR']).nullable().optional(),
});

export const externalParticipantUpdateSchema = externalParticipantSchema.partial().omit({ externalTrainingId: true });

// §9: Training Method master.
export const trainingMethodSchema = z.object({
  code: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  delivery: z.enum(['INTERNAL', 'EXTERNAL']).nullable().optional(),
  mode: z.enum(['ONLINE', 'OFFLINE', 'BLENDED']).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const trainingMethodUpdateSchema = trainingMethodSchema.partial();

export const employeeSkillLevelSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  skillId: z.coerce.number().int().positive(),
  currentLevelId: z.coerce.number().int().positive(),
  targetLevelId: z.coerce.number().int().positive().nullable().optional(),
});

// ── Phase 12: Documents, External Training, IDP (BRD §35, §38, §48) ─────────

export const trainingDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  docType: z.enum(['MATERIAL', 'ATTENDANCE_SHEET', 'CERTIFICATE', 'INVOICE', 'PO', 'POLICY', 'OTHER']).default('MATERIAL'),
  filePath: z.string().max(500),
  fileSize: z.coerce.number().int().nullable().optional(),
  mimeType: z.string().max(100).nullable().optional(),
  trainingScheduleId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  employeeId: z.coerce.number().int().positive().nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

export const externalTrainingSchema = z.object({
  title: z.string().min(1).max(200),
  // providerName stays free-text for legacy rows; providerId links to the master (§35).
  providerName: z.string().max(200).nullable().optional(),
  providerId: z.coerce.number().int().positive().nullable().optional(), // §35 link to TrainingProvider master
  providerContact: z.string().max(200).nullable().optional(),
  trainerName: z.string().max(100).nullable().optional(), // §35 external trainer (distinct from provider org)
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  employeeIds: z.string().nullable().optional(), // CSV
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  poNumber: z.string().max(50).nullable().optional(),
  poAmount: z.coerce.number().nullable().optional(),
  invoiceNumber: z.string().max(50).nullable().optional(),
  invoiceAmount: z.coerce.number().nullable().optional(),
  invoiceDate: z.coerce.date().nullable().optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).default('UNPAID'),
  paidAmount: z.coerce.number().nullable().optional(),
  paidDate: z.coerce.date().nullable().optional(),
  certificateIssued: z.boolean().default(false),
  status: z.enum(['PLANNED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
  remarks: z.string().max(500).nullable().optional(),
});

export const externalTrainingUpdateSchema = externalTrainingSchema.partial();

export const idpSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200),
  goal: z.string().max(500).nullable().optional(),
  competencyId: z.coerce.number().int().positive().nullable().optional(),
  skillId: z.coerce.number().int().positive().nullable().optional(),
  currentLevelId: z.coerce.number().int().positive().nullable().optional(),
  targetLevelId: z.coerce.number().int().positive().nullable().optional(),
  trainingProgramId: z.coerce.number().int().positive().nullable().optional(),
  mentorEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  progressNotes: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).default('ACTIVE'),
});

export const idpUpdateSchema = idpSchema.partial();

// ── Phase 25 masters (BRD §17/18/19/47) ──────────────────────────

export const trainingMentorSchema = z.object({
  employeeId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(100),
  email: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  expertise: z.string().max(300).nullable().optional(),
  role: z.string().max(100).nullable().optional(),
  assignedToIds: z.string().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  expectedOutcome: z.string().max(300).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
export const trainingMentorUpdateSchema = trainingMentorSchema.partial();

export const trainingResourceSchema = z.object({
  name: z.string().min(1).max(100),
  resourceType: z.string().max(50).nullable().optional(),
  venueId: z.coerce.number().int().positive().nullable().optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE', 'RETIRED']).default('AVAILABLE'),
  notes: z.string().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
});
export const trainingResourceUpdateSchema = trainingResourceSchema.partial();

export const trainingProviderSchema = z.object({
  name: z.string().min(1).max(150),
  contactName: z.string().max(100).nullable().optional(),
  email: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  categories: z.string().max(300).nullable().optional(),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
export const trainingProviderUpdateSchema = trainingProviderSchema.partial();

export const certificationMasterSchema = z.object({
  name: z.string().min(1).max(150),
  issuingBody: z.string().max(150).nullable().optional(),
  validityMonths: z.coerce.number().int().positive().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  isMandatory: z.boolean().default(false),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
export const certificationMasterUpdateSchema = certificationMasterSchema.partial();
