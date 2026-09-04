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
  shiftPlanId: z.number().int().positive().nullable().optional(),
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
