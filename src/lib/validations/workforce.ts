/**
 * Zod validation schemas for Time Office Phase 1 (Attendance + Leave).
 */

import { z } from 'zod';

/**
 * Parses "YYYY-MM-DDTHH:mm" as literal UTC wall-clock digits (the app-wide
 * "neutral wall-clock" convention documented in the Daily Attendance page —
 * inTime/outTime mean "9:15am at the workplace", not a real UTC instant).
 * Deliberately NOT z.coerce.date(): plain `new Date("...")` on a string with
 * no timezone suffix parses as the SERVER's local timezone, so on a non-UTC
 * host (this one runs in IST) "09:15" silently becomes 03:45 UTC. Every
 * other write path (biometric sync) already avoids this via explicit
 * Date.UTC() construction — this brings manual entry in line for mispunch.
 */
const wallClockDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Expected YYYY-MM-DDTHH:mm')
  .transform((s) => {
    const [datePart, timePart] = s.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  });

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
  // Computed on the server from working days (leave core 2026-09-25);
  // accepted for backwards compatibility and ignored.
  numberOfDays: z.number().positive().optional(),
  isHalfDay: z.boolean().default(false),
  reason: z.string().max(500).optional().nullable(),
});

// Self-service variant — same shape minus employeeId, which is always
// resolved from the caller's own session, never taken from the request body.
export const myLeaveApplicationSchema = z
  .object({
    leaveMasterId: z.coerce.number().int().positive(),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    numberOfDays: z.coerce.number().positive().optional(),
    isHalfDay: z.coerce.boolean().default(false),
    reason: z.string().max(500).optional().nullable(),
  })
  // A reversed range previously only failed indirectly, via numberOfDays
  // computing to 0 and tripping .positive() — which reported the wrong field.
  .refine((v) => v.toDate >= v.fromDate, {
    message: 'To date must be on or after from date',
    path: ['toDate'],
  });

export const leaveRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const mispunchRequestSchema = z
  .object({
    date: z.coerce.date(),
    requestedInTime: wallClockDateTime.nullable().optional(),
    requestedOutTime: wallClockDateTime.nullable().optional(),
    reason: z.string().min(1).max(500),
  })
  .refine((v) => v.requestedInTime || v.requestedOutTime, {
    message: 'At least one of requestedInTime or requestedOutTime is required',
  })
  // Both are full wall-clock datetimes, so a night shift ending the next
  // morning passes — it carries the later date. What this rejects is an out
  // that lands before the in on the same day, which the form could otherwise
  // submit happily (e.g. in 9:37 AM, out 6:47 AM).
  .refine((v) => !(v.requestedInTime && v.requestedOutTime) || v.requestedOutTime > v.requestedInTime, {
    message: 'Out time must be after in time',
    path: ['requestedOutTime'],
  })
  .refine((v) => v.date.getTime() <= Date.now(), {
    message: 'Cannot request a correction for a future date',
    path: ['date'],
  });

export const mispunchRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const otRequestSchema = z.object({
  date: z.coerce.date(),
  requestedMinutes: z.coerce.number().int().positive().max(720, 'Cannot request more than 12 hours of OT in one request'),
  reason: z.string().min(1).max(500),
}).refine((v) => v.date.getTime() <= Date.now(), {
  message: 'Cannot request overtime for a future date',
  path: ['date'],
});

export const otRequestRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const permissionRequestSchema = z
  .object({
    date: z.coerce.date(),
    fromTime: wallClockDateTime,
    toTime: wallClockDateTime,
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((v) => v.toTime > v.fromTime, { message: 'toTime must be after fromTime', path: ['toTime'] });

export const onDutyRequestSchema = z
  .object({
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    location: z.string().min(1).max(200),
    purpose: z.string().min(1).max(500),
    customerProject: z.string().max(200).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
    durationType: z.enum(['half_day', '3_hours', '4_hours', 'full_day']).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'toDate must be on or after fromDate', path: ['toDate'] });

export const wfhRequestSchema = z
  .object({
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
    remarks: z.string().max(500).optional().nullable(),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'toDate must be on or after fromDate', path: ['toDate'] });

export const permissionRejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export const pmsIncentiveConfigSchema = z
  .object({
    financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Expected format YYYY-YY'),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date(),
    calculationBasis: z.enum(['basic', 'gross', 'ctc', 'target_incentive', 'component']),
    salaryComponentId: z.number().int().positive().nullable().optional(),
    incentiveType: z.enum(['percentage', 'fixed']).default('percentage'),
    companyPercent: z.coerce.number().min(0).max(50).default(0),
    companyValue: z.coerce.number().min(0).nullable().optional(),
    targetIncentiveAmount: z.coerce.number().min(0).nullable().optional(),
    remarks: z.string().max(500).nullable().optional(),
    status: z.enum(['draft', 'active', 'finalized']).default('active'),
  })
  .refine((v) => v.effectiveTo >= v.effectiveFrom, {
    message: 'Effective To must be on or after Effective From',
    path: ['effectiveTo'],
  })
  .refine((v) => v.calculationBasis !== 'component' || Boolean(v.salaryComponentId), {
    message: 'Select a salary component when the calculation basis is Other',
    path: ['salaryComponentId'],
  })
  .refine((v) => v.incentiveType !== 'percentage' || v.companyPercent <= 50, {
    message: 'Company Incentive cannot exceed 50%.',
    path: ['companyPercent'],
  });

export const pmsIncentiveUpsertSchema = z.object({
  employeeId: z.number().int().positive(),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Expected format YYYY-YY'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  companyPercent: z.coerce.number().min(0).max(50).nullable().optional(),
  companyValue: z.coerce.number().min(0).nullable().optional(),
  individualPercent: z.coerce.number().min(0).max(50).nullable().optional(),
  individualValue: z.coerce.number().min(0).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  submit: z.boolean().optional(),
});

export const pmsIncentiveUpdateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Expected format YYYY-YY').optional(),
  individualPercent: z.coerce.number().min(0).max(50).nullable().optional(),
  individualValue: z.coerce.number().min(0).nullable().optional(),
  companyPercent: z.coerce.number().min(0).max(50).nullable().optional(),
  companyValue: z.coerce.number().min(0).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  submit: z.boolean().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export const pmsRejectSchema = z.object({
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
