/**
 * Unit tests for the shared attendance merge (src/lib/attendanceMerge.ts).
 *
 * A fully in-memory fake Prisma client drives reconcileAttendanceDay — no
 * real database is touched. The mock covers both the `db` argument and the
 * module-level `prisma` that the weekly-off/holiday helpers use.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Controllable fake DB state ──────────────────────────────────────────
// vi.hoisted so the hoisted vi.mock factory can reference these safely.
const { state, fakeDb } = vi.hoisted(() => {
  const state = {
    sourceDays: [] as Array<Record<string, unknown>>,
    existing: null as Record<string, unknown> | null,
    summary: null as { status: string } | null,
    lastHistory: null as { changedBySource: string } | null,
    writes: [] as Array<{ op: 'create' | 'update' | 'history'; data: Record<string, unknown> }>,
  };

  const fakeDb = {
    attendanceSourceDay: {
      findMany: async () => state.sourceDays,
      upsert: async () => ({}),
    },
    dailyAttendance: {
      findUnique: async () => state.existing,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.writes.push({ op: 'create', data });
        return { id: 1, ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.writes.push({ op: 'update', data });
        return { ...state.existing, ...data };
      },
    },
    dailyAttendanceHistory: {
      findFirst: async () => state.lastHistory,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.writes.push({ op: 'history', data });
        return data;
      },
    },
    monthlyAttendanceSummary: {
      findUnique: async () => state.summary,
      upsert: async () => ({}),
    },
    shiftAssignmentOverride: { findUnique: async () => null },
    jobInfo: {
      findFirst: async () => ({ overtimeAllowed: true }),
      findMany: async () => [],
    },
    oTPlan: { findFirst: async () => null },
    shiftMaster: { findUnique: async () => null },
    shiftRotationPlan: { findUnique: async () => null },
    departmentWeeklyOff: { findMany: async () => [] },
    holidayMaster: { findFirst: async () => null },
    yearlyLeaveCalendar: { findFirst: async () => null },
  };

  return { state, fakeDb };
});

vi.mock('@/lib/prisma', () => ({ prisma: fakeDb }));

import { reconcileAttendanceDay } from '@/lib/attendanceMerge';
import type { EmployeeShiftConfig } from '@/lib/biometricConversion';

// A fixed 09:00–17:30 shift so derivations are deterministic.
const SHIFT: EmployeeShiftConfig = {
  assignmentType: 'GENERAL',
  generalShift: { id: 7, startMinutes: 9 * 60, endMinutes: 17 * 60 + 30, standardMinutes: 8 * 60 + 30, graceMinutes: 10 },
  rotationSlots: null,
  rotationAnchorDate: null,
  otThresholdMinutes: 0,
  maxOtMinutesPerDay: null,
};

const DAY = new Date(Date.UTC(2026, 8, 21)); // Mon 21 Sep 2026 — a weekday
const OPTS = { companyId: 1, userId: null, shiftConfig: SHIFT };

function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(DAY);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function bioDay(inT: string | null, outT: string | null) {
  return { source: 'biometric', inTime: inT ? at(inT) : null, outTime: outT ? at(outT) : null, sourceRowId: 'bio:1' };
}
function appDay(inT: string | null, outT: string | null, gps = true) {
  return {
    source: 'app',
    inTime: inT ? at(inT) : null,
    outTime: outT ? at(outT) : null,
    inLatitude: gps ? 13.05 : null,
    inLongitude: gps ? 80.24 : null,
    outLatitude: gps ? 13.06 : null,
    outLongitude: gps ? 80.25 : null,
    sourceRowId: '42',
  };
}

function lastWrite() {
  return state.writes[state.writes.length - 1];
}

beforeEach(() => {
  state.sourceDays = [];
  state.existing = null;
  state.summary = null;
  state.lastHistory = null;
  state.writes = [];
});

describe('reconcileAttendanceDay — source selection', () => {
  it('biometric-only day produces a biometric row', async () => {
    state.sourceDays = [bioDay('09:05', '18:10')];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    const w = lastWrite();
    expect(w.op).toBe('create');
    expect(w.data.inTime).toEqual(at('09:05'));
    expect(w.data.outTime).toEqual(at('18:10'));
    expect(w.data.source).toBe('biometric');
    expect(w.data.inSource).toBe('biometric');
    expect(w.data.inLatitude).toBeNull();
  });

  it('app-only day produces an app row with GPS', async () => {
    state.sourceDays = [appDay('08:55', '18:00')];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    const w = lastWrite();
    expect(w.data.source).toBe('app');
    expect(w.data.inSource).toBe('app');
    expect(w.data.inLatitude).toBeCloseTo(13.05);
    expect(w.data.outLongitude).toBeCloseTo(80.25);
  });

  it('merged day takes earliest in and latest out across sources', async () => {
    state.sourceDays = [bioDay('09:05', '18:10'), appDay('08:55', '18:00')];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    const w = lastWrite();
    // App in is earlier BUT 08:55 is within the 2h early snap of a 09:00
    // shift — deriveStatusAndMinutes snaps it to shift start, so the stored
    // inTime is 09:00 while the attribution still says the app supplied it.
    expect(w.data.inTime).toEqual(at('09:00'));
    expect(w.data.outTime).toEqual(at('18:10'));
    expect(w.data.inSource).toBe('app');
    expect(w.data.outSource).toBe('biometric');
    expect(w.data.source).toBe('biometric+app');
    // GPS follows the app IN endpoint; the biometric OUT carries none.
    expect(w.data.inLatitude).toBeCloseTo(13.05);
    expect(w.data.outLatitude).toBeNull();
  });

  it('exact-tie endpoint prefers the app', async () => {
    state.sourceDays = [bioDay('09:10', '18:10'), appDay('09:10', '18:00')];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    expect(lastWrite().data.inSource).toBe('app');
  });

  it('single punch is MissingPunch, never invents the other endpoint', async () => {
    state.sourceDays = [appDay('09:10', null)];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    expect(lastWrite().data.status).toBe('MissingPunch');
    expect(lastWrite().data.outTime).toBeNull();
  });

  it('no contributions means no write', async () => {
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('no_source');
    expect(state.writes).toHaveLength(0);
  });
});

describe('reconcileAttendanceDay — corrections & idempotency', () => {
  it('a corrected app contribution replaces the previously winning punch', async () => {
    // App originally won IN at 08:00; source corrects it to 09:20.
    state.sourceDays = [bioDay('09:30', '17:45'), appDay('09:20', '17:50')];
    state.existing = {
      status: 'Present',
      inTime: at('08:00'),
      outTime: at('17:50'),
      workingMinutes: 0,
      lateMinutes: 0,
      earlyOutMinutes: 0,
      otMinutesCalculated: 0,
      otMinutesApproved: null,
      otApprovalStatus: null,
      lomApprovalStatus: null,
      isWeeklyOffWorked: false,
      isHolidayWorked: false,
      source: 'biometric+app',
      remarks: null,
      shiftMasterId: 7,
      inLatitude: 13.0,
      inLongitude: 80.0,
      outLatitude: 13.0,
      outLongitude: 80.0,
      inSource: 'app',
      outSource: 'app',
      inSourceRef: '40',
      outSourceRef: '40',
    };
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('updated');
    const w = lastWrite();
    expect(w.data.inTime).toEqual(at('09:20')); // the stale 08:00 is gone
    expect(w.data.inSourceRef).toBe('42');
  });

  it('identical merge result leaves no write and no history', async () => {
    state.sourceDays = [bioDay('09:05', '17:45')];
    state.existing = {
      status: 'Present',
      inTime: at('09:05'),
      outTime: at('17:45'),
      workingMinutes: 8 * 60 + 40, // 17:45-09:05 = 520
      lateMinutes: 5,
      earlyOutMinutes: 0,
      otMinutesCalculated: 10, // 520 - 510
      otMinutesApproved: null,
      otApprovalStatus: 'pending_manager',
      lomApprovalStatus: 'pending',
      isWeeklyOffWorked: false,
      isHolidayWorked: false,
      source: 'biometric',
      remarks: null,
      shiftMasterId: 7,
      inLatitude: null,
      inLongitude: null,
      outLatitude: null,
      outLongitude: null,
      inSource: 'biometric',
      outSource: 'biometric',
      inSourceRef: 'bio:1',
      outSourceRef: 'bio:1',
    };
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('unchanged');
    expect(state.writes.filter((w) => w.op === 'update')).toHaveLength(0);
    expect(state.writes.filter((w) => w.op === 'history')).toHaveLength(0);
  });

  it('biometric replacing an app endpoint clears that endpoint GPS', async () => {
    state.sourceDays = [bioDay('08:30', '18:10'), appDay('08:55', '18:00')];
    // biometric IN 08:30 is >2h before shift start → not snapped, wins outright.
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('created');
    const w = lastWrite();
    expect(w.data.inSource).toBe('biometric');
    expect(w.data.inLatitude).toBeNull();
    expect(w.data.inLongitude).toBeNull();
  });
});

describe('reconcileAttendanceDay — protections', () => {
  const existingBioDay = (over: Record<string, unknown> = {}) => ({
    status: 'Present',
    inTime: at('09:05'),
    outTime: at('17:45'),
    workingMinutes: 520,
    lateMinutes: 5,
    earlyOutMinutes: 0,
    otMinutesCalculated: 10,
    otMinutesApproved: null,
    otApprovalStatus: null,
    lomApprovalStatus: null,
    isWeeklyOffWorked: false,
    isHolidayWorked: false,
    source: 'biometric',
    remarks: null,
    shiftMasterId: 7,
    inLatitude: null,
    inLongitude: null,
    outLatitude: null,
    outLongitude: null,
    inSource: 'biometric',
    outSource: 'biometric',
    inSourceRef: null,
    outSourceRef: null,
    ...over,
  });

  it.each(['FINALIZED', 'FROZEN', 'READY_FOR_PAYROLL'])('locked month %s is skipped', async (s) => {
    state.summary = { status: s };
    state.sourceDays = [bioDay('09:05', '18:10')];
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('skipped_locked_month');
    expect(state.writes).toHaveLength(0);
  });

  it('manual-corrected day (last history write manual) differing is held for review', async () => {
    state.sourceDays = [bioDay('09:05', '18:10'), appDay('08:00', '18:30')];
    state.existing = existingBioDay();
    state.lastHistory = { changedBySource: 'manual' };
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('needs_review');
    expect(state.writes.filter((w) => w.op === 'update')).toHaveLength(0);
  });

  it('decided OT approval + differing punches is held for review', async () => {
    state.sourceDays = [bioDay('09:05', '18:10'), appDay('08:00', '18:30')];
    state.existing = existingBioDay({ otApprovalStatus: 'approved', otMinutesApproved: 10 });
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('needs_review');
    expect(state.writes.filter((w) => w.op === 'update')).toHaveLength(0);
  });

  it('workflow-owned status (Leave) is never overwritten', async () => {
    state.sourceDays = [appDay('09:00', '18:00')];
    state.existing = existingBioDay({ status: 'Leave' });
    state.lastHistory = { changedBySource: 'manual' };
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('needs_review');
  });

  it('auto-marked SYSTEM_AUTO LOP row is superseded by a real app punch', async () => {
    state.sourceDays = [appDay('09:00', '18:00')];
    state.existing = existingBioDay({
      status: 'LOP',
      source: 'SYSTEM_AUTO',
      inTime: null,
      outTime: null,
      workingMinutes: 0,
      lateMinutes: 0,
      otMinutesCalculated: 0,
      inSource: null,
      outSource: null,
    });
    // no history rows — machine-written row
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('updated');
    const w = lastWrite();
    expect(w.data.inTime).toEqual(at('09:00'));
    expect(w.data.inLatitude).toBeCloseTo(13.05);
  });

  it('approval-owned status without history is still held for review', async () => {
    state.sourceDays = [appDay('09:00', '18:00')];
    state.existing = existingBioDay({ status: 'Leave', source: 'SYSTEM_AUTO' });
    // Leave is approval-owned even when the row claims a system source.
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('needs_review');
    expect(state.writes.filter((w) => w.op === 'update')).toHaveLength(0);
  });

  it('decided LOM approval survives a same-punch write', async () => {
    state.sourceDays = [bioDay('09:05', '17:45')];
    state.existing = existingBioDay({
      lomApprovalStatus: 'approved',
      otApprovalStatus: 'pending_manager', // already queued — matches what the write auto-queues
      inSourceRef: 'bio:1',
      outSourceRef: 'bio:1',
    });
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    // Same punches → unchanged; the approved LOM is never re-pended.
    expect(outcome).toBe('unchanged');
  });

  it('a differing-punch write on a decided-LOM day is held, not applied', async () => {
    state.sourceDays = [bioDay('09:05', '17:45'), appDay('08:00', '19:00')];
    state.existing = existingBioDay({ lomApprovalStatus: 'approved', inSourceRef: 'bio:1', outSourceRef: 'bio:1' });
    const outcome = await reconcileAttendanceDay(fakeDb as never, 10, DAY, OPTS);
    expect(outcome).toBe('needs_review');
    expect(state.writes.filter((w) => w.op === 'update')).toHaveLength(0);
  });
});
