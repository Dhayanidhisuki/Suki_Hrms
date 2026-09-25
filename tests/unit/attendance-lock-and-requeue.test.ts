/**
 * Pure-logic coverage for the 2026-09-25 Time Office fixes
 * (docs/TIME_OFFICE_FLOW_AUDIT_2026-09-25.md):
 *
 *   A2 — upsertDailyAttendanceWithHistory must NOT re-queue an approved OT /
 *        LOM decision when a re-sync writes the same minutes again.
 *   A1 — isProtectedFromDeviceOverwrite: which rows the device may not touch.
 *   C5 — monthsBetween walks every month of a range, not just the ends.
 *
 * The upsert takes its db client as a parameter, so a hand-rolled fake is
 * enough — no database.
 */
import { describe, it, expect } from 'vitest';
import { upsertDailyAttendanceWithHistory, isProtectedFromDeviceOverwrite } from '@/lib/attendanceHistory';
import { monthsBetween } from '@/lib/attendanceFreeze';

type Row = Record<string, unknown>;

/** Minimal stand-in for the Prisma client surface the upsert touches. */
function fakeDb(existing: Row | null, otEligible = true) {
  const writes: { update?: Row; create?: Row; history?: Row } = {};
  const db = {
    jobInfo: { findFirst: async () => ({ overtimeAllowed: otEligible }) },
    dailyAttendance: {
      findUnique: async () => existing,
      create: async ({ data }: { data: Row }) => { writes.create = data; return data; },
      update: async ({ data }: { data: Row }) => { writes.update = data; return data; },
    },
    dailyAttendanceHistory: { create: async ({ data }: { data: Row }) => { writes.history = data; return data; } },
  };
  return { db: db as unknown as Parameters<typeof upsertDailyAttendanceWithHistory>[0], writes };
}

const DATE = new Date('2098-04-06T00:00:00.000Z');
const at = (h: number, m = 0) => { const d = new Date(DATE); d.setUTCHours(h, m, 0, 0); return d; };

function approvedRow(): Row {
  return {
    status: 'Present', inTime: at(9), outTime: at(19), workingMinutes: 600,
    lateMinutes: 0, earlyOutMinutes: 0,
    otMinutesCalculated: 60, otMinutesApproved: 60, otApprovalStatus: 'approved', otSettlementType: 'OT',
    lomApprovalStatus: 'approved', isWeeklyOffWorked: false, isHolidayWorked: false,
    source: 'biometric', remarks: null, shiftMasterId: 1,
  };
}

describe('A2 — re-sync does not undo OT / LOM decisions', () => {
  it('same OT minutes again → approval and approved minutes untouched', async () => {
    const { db, writes } = fakeDb(approvedRow());
    const r = await upsertDailyAttendanceWithHistory(db, 1, DATE, {
      status: 'Present', inTime: at(9), outTime: at(19), workingMinutes: 600,
      otMinutesCalculated: 60, lateMinutes: 0, earlyOutMinutes: 0, source: 'biometric', shiftMasterId: 1,
    }, { userId: null, changedBySource: 'biometric' });
    expect(r.outcome).toBe('unchanged');
    expect(writes.update).toBeUndefined();
  });

  it('same OT minutes but a different out-punch → row updates, decision still kept', async () => {
    const { db, writes } = fakeDb(approvedRow());
    await upsertDailyAttendanceWithHistory(db, 1, DATE, {
      status: 'Present', inTime: at(9), outTime: at(19, 5), workingMinutes: 605,
      otMinutesCalculated: 60, lateMinutes: 0, earlyOutMinutes: 0, source: 'biometric', shiftMasterId: 1,
    }, { userId: null, changedBySource: 'biometric' });
    expect(writes.update).toBeDefined();
    expect(writes.update).not.toHaveProperty('otApprovalStatus');
    expect(writes.update).not.toHaveProperty('otMinutesApproved');
    expect(writes.update).not.toHaveProperty('lomApprovalStatus');
  });

  it('different OT minutes → re-queued for approval (new evidence, new decision)', async () => {
    const { db, writes } = fakeDb(approvedRow());
    await upsertDailyAttendanceWithHistory(db, 1, DATE, {
      otMinutesCalculated: 120, lateMinutes: 0, earlyOutMinutes: 0,
    }, { userId: null, changedBySource: 'biometric' });
    expect(writes.update?.otApprovalStatus).toBe('pending_manager');
    expect(writes.update?.otMinutesApproved).toBeNull();
  });

  it('late minutes change → LOM re-queued; unchanged → kept', async () => {
    const changed = fakeDb(approvedRow());
    await upsertDailyAttendanceWithHistory(changed.db, 1, DATE, { lateMinutes: 15, earlyOutMinutes: 0 }, { userId: null, changedBySource: 'biometric' });
    expect(changed.writes.update?.lomApprovalStatus).toBe('pending');

    const same = fakeDb({ ...approvedRow(), lateMinutes: 15, lomApprovalStatus: 'rejected' });
    await upsertDailyAttendanceWithHistory(same.db, 1, DATE, { lateMinutes: 15, remarks: 'x' }, { userId: null, changedBySource: 'manual' });
    expect(same.writes.update).not.toHaveProperty('lomApprovalStatus');
  });

  it('a brand-new row with OT still queues', async () => {
    const { db, writes } = fakeDb(null);
    await upsertDailyAttendanceWithHistory(db, 1, DATE, { status: 'Present', otMinutesCalculated: 45, lateMinutes: 0 }, { userId: null, changedBySource: 'biometric' });
    expect(writes.create?.otApprovalStatus).toBe('pending_manager');
  });
});

describe('A1 — what the device may not overwrite', () => {
  it('a manual (human-decided) row is protected from a biometric write', () => {
    expect(isProtectedFromDeviceOverwrite({ source: 'manual', status: 'Present' }, 'biometric')).toBe(true);
  });
  it('a biometric row may be re-written by the device', () => {
    expect(isProtectedFromDeviceOverwrite({ source: 'biometric', status: 'MissingPunch' }, 'biometric')).toBe(false);
  });
  it('a finalize-generated placeholder (SYSTEM_AUTO LOP) yields to real device data', () => {
    expect(isProtectedFromDeviceOverwrite({ source: 'SYSTEM_AUTO', status: 'LOP' }, 'biometric')).toBe(false);
  });
  it('approved Leave / OnDuty is protected from every ingestion write', () => {
    expect(isProtectedFromDeviceOverwrite({ source: 'manual', status: 'Leave' }, 'manual')).toBe(true);
    expect(isProtectedFromDeviceOverwrite({ source: 'manual', status: 'OnDuty' }, 'biometric')).toBe(true);
  });
  it('a human-uploaded MANUAL file may overwrite a manual row', () => {
    expect(isProtectedFromDeviceOverwrite({ source: 'manual', status: 'Present' }, 'manual')).toBe(false);
  });
});

describe('C5 — monthsBetween covers the middle of a range', () => {
  it('Jan 28 → Mar 2 = three months', () => {
    const months = monthsBetween(new Date('2098-01-28T00:00:00Z'), new Date('2098-03-02T00:00:00Z'));
    expect(months.map((m) => m.getUTCMonth() + 1)).toEqual([1, 2, 3]);
  });
  it('same month = one entry', () => {
    expect(monthsBetween(new Date('2098-05-03T00:00:00Z'), new Date('2098-05-30T00:00:00Z'))).toHaveLength(1);
  });
});
