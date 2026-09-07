/**
 * Zod validation schemas for Time Office Phase 1 (Attendance + Leave).
 */

import { z } from 'zod';

const ATTENDANCE_STATUSES = [
  'Present',
  'Absent',
  'HalfDay',
  'WeeklyOff',
  'Holiday',
  'Leave',
  'Permission',
  'OnDuty',
  'MissingPunch',
  'LOP',
] as const;

export const dailyAttendanceSchema = z.object({
  employeeId: z.number().int().positive(),
  date: z.coerce.date(),
  shiftMasterId: z.number().int().positive().nullable().optional(),
  status: z.enum(ATTENDANCE_STATUSES),
  inTime: z.coerce.date().nullable().optional(),
  outTime: z.coerce.date().nullable().optional(),
  workingMinutes: z.number().int().min(0).default(0),
  lateMinutes: z.number().int().min(0).default(0),
  earlyOutMinutes: z.number().int().min(0).default(0),
  otMinutesCalculated: z.number().int().min(0).default(0),
  remarks: z.string().max(500).optional().nullable(),
});

export const attendanceOtApprovalSchema = z.object({
  otMinutesApproved: z.number().int().min(0),
  otApprovalStatus: z.enum(['approved', 'rejected']),
});

export const leaveApplicationSchema = z.object({
  employeeId: z.number().int().positive(),
  leaveMasterId: z.number().int().positive(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  numberOfDays: z.number().positive(),
  isHalfDay: z.boolean().default(false),
  reason: z.string().max(500).optional().nullable(),
});

export const leaveRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const reopenMonthSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ── Biometric attendance import (Phase 1) ──────────────────────────────────
// One landing table merges 3 legacy source shapes (hours / in-time /
// out-time) — see prisma/schema.prisma's BiometricAttendanceImport comment.
// Each source shares the same day1..day31 numbering; only the suffix and the
// extra hours-only fields differ, hence the shared field-builder below.

function numericDayFields(suffix: '' | 'InTime' | 'OutTime') {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (let d = 1; d <= 31; d++) {
    shape[`day${d}${suffix}`] = z.coerce.number().min(0).max(9999.99).nullable().optional();
  }
  return shape;
}

const biometricRowKeySchema = {
  empIdRaw: z.string().min(1).max(20),
  year: z.coerce.number().int().min(2000).max(2100),
  attForMonth: z.string().min(1).max(30),
};

export const biometricHoursRowSchema = z.object({
  ...biometricRowKeySchema,
  refNo: z.coerce.number().int().nullable().optional(),
  total: z.coerce.number().min(0).max(99999999.99).optional(),
  totalLom: z.coerce.number().min(0).max(99999999.99).optional(),
  totalOtHrs: z.coerce.number().min(0).max(99999999.99).optional(),
  creatUserIdCd: z.string().max(50).nullable().optional(),
  creatDt: z.coerce.date().nullable().optional(),
  lstUpdtUserIdCd: z.string().max(50).nullable().optional(),
  lstUpdtTs: z.coerce.date().nullable().optional(),
  attEndMonth: z.coerce.date().nullable().optional(),
  ...numericDayFields(''),
});

export const biometricInTimeRowSchema = z.object({
  ...biometricRowKeySchema,
  ...numericDayFields('InTime'),
});

export const biometricOutTimeRowSchema = z.object({
  ...biometricRowKeySchema,
  ...numericDayFields('OutTime'),
});

export const biometricImportEnvelopeSchema = z.object({
  periodStartDate: z.coerce.date(),
  source: z.enum(['hours', 'intime', 'outtime']),
  fromWhere: z.enum(['MANUAL', 'BIOMETRIC']).default('MANUAL'),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
});

export type BiometricHoursRow = z.infer<typeof biometricHoursRowSchema>;
export type BiometricInTimeRow = z.infer<typeof biometricInTimeRowSchema>;
export type BiometricOutTimeRow = z.infer<typeof biometricOutTimeRowSchema>;
