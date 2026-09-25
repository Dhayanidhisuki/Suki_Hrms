/**
 * End-to-end coverage of the 2026-09-25 Time Office fixes against the real
 * dev database (docs/TIME_OFFICE_FLOW_AUDIT_2026-09-25.md):
 *
 *   C1/C2  one lock rule — FROZEN, READY_FOR_PAYROLL, or payroll processed
 *   C3     writers that used to bypass the lock now return 409
 *   B4     finalize refuses a locked month
 *   C2     payroll lock freezes attendance; reopen refuses after payroll
 *   D1     one-sided mispunch correction keeps the recorded punch
 *   A1     a biometric import does not overwrite the corrected day
 *
 * Uses a TEST-AUTO- employee and year 2098 (the biometric suite owns 2099)
 * so nothing here can collide with real data.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee } from './fixtures';
import { getAttendanceLock } from '@/lib/attendanceFreeze';

const YEAR = 2098;
const OLD_EMP_CODE = 'TEST-AUTO-TOF01';
const NEEDED_PERMISSIONS = [
  'workforce.mispunch.approve',
  'workforce.ot.approve',
  'workforce.attendance.edit',
  'workforce.biometric.edit',
  'payroll.processing.approve',
];

let companyId: number;
let auth: { roleId: number; userId: number };
let employeeId: number;
const tempGrantIds: number[] = [];
const createdRunIds: number[] = [];

function req(url: string, opts: { method?: string; body?: unknown } = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-role-id': String(auth.roleId),
    'x-user-id': String(auth.userId),
    'x-company-id': String(companyId),
  });
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const day = (m: number, d: number) => new Date(Date.UTC(YEAR, m - 1, d));
const at = (m: number, d: number, h: number, min = 0) => new Date(Date.UTC(YEAR, m - 1, d, h, min));
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

async function setSummary(month: number, status: string) {
  await prisma.monthlyAttendanceSummary.upsert({
    where: { employeeId_year_month: { employeeId, year: YEAR, month } },
    update: { status },
    create: { employeeId, year: YEAR, month, status },
  });
}

async function createRun(month: number, status: string) {
  const run = await prisma.payrollRun.create({ data: { companyId, year: YEAR, month, status } });
  createdRunIds.push(run.id);
  return run;
}

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
  if (!company) throw new Error('No active company.');
  companyId = company.id;

  const adminRole = await prisma.role.findFirst({ where: { companyId, code: 'company-admin', isActive: true } });
  if (!adminRole) throw new Error(`No company-admin role for company ${companyId}.`);
  const adminUser = await prisma.user.findFirst({ where: { companyId, roleId: adminRole.id, isActive: true, deletedAt: null } });
  if (!adminUser) throw new Error(`No active user with role ${adminRole.id}.`);
  auth = { roleId: adminRole.id, userId: adminUser.id };

  // Grant anything the admin role is missing for the duration of the suite,
  // and remember what to revoke.
  for (const code of NEEDED_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({ where: { code } });
    if (!permission) throw new Error(`Permission ${code} is not seeded.`);
    const existing = await prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: auth.roleId, permissionId: permission.id } } });
    if (!existing) {
      const grant = await prisma.rolePermission.create({ data: { roleId: auth.roleId, permissionId: permission.id } });
      tempGrantIds.push(grant.id);
    }
  }

  const created = await createTestEmployee(auth, { companyId, oldEmployeeCode: OLD_EMP_CODE, lastName: 'TimeOffice' });
  employeeId = created.id;
});

afterAll(async () => {
  await prisma.mispunchCorrection.deleteMany({ where: { employeeId } });
  await prisma.dailyAttendance.deleteMany({ where: { employeeId } });
  await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId } });
  await prisma.biometricAttendanceImport.deleteMany({ where: { companyId, empIdRaw: OLD_EMP_CODE, year: YEAR } });
  if (createdRunIds.length) {
    await prisma.payrollLineComponent.deleteMany({ where: { payrollLine: { payrollRunId: { in: createdRunIds } } } });
    await prisma.payrollLine.deleteMany({ where: { payrollRunId: { in: createdRunIds } } });
    await prisma.payrollRun.deleteMany({ where: { id: { in: createdRunIds } } });
  }
  if (tempGrantIds.length) await prisma.rolePermission.deleteMany({ where: { id: { in: tempGrantIds } } });
  await deleteTestEmployee(employeeId);
});

describe('One lock rule (C1 / C2)', () => {
  it('an OPEN month with no summary is not locked', async () => {
    expect(await getAttendanceLock(employeeId, day(1, 10))).toBeNull();
  });

  it('READY_FOR_PAYROLL locks the month (it used to lock nothing)', async () => {
    await setSummary(1, 'READY_FOR_PAYROLL');
    expect((await getAttendanceLock(employeeId, day(1, 10)))?.reason).toBe('READY_FOR_PAYROLL');
    await setSummary(1, 'FROZEN');
    expect((await getAttendanceLock(employeeId, day(1, 10)))?.reason).toBe('FROZEN');
    await setSummary(1, 'OPEN');
    expect(await getAttendanceLock(employeeId, day(1, 10))).toBeNull();
  });

  it('an APPROVED payroll run locks the month even with an OPEN summary', async () => {
    const run = await createRun(3, 'APPROVED');
    expect((await getAttendanceLock(employeeId, day(3, 15)))?.reason).toBe('PAYROLL_PROCESSED');

    const { POST: reopen } = await import('@/app/api/workforce/attendance/monthly/reopen/route');
    const reopenRes = await reopen(req('http://localhost/api/workforce/attendance/monthly/reopen', { method: 'POST', body: { year: YEAR, month: 3, reason: 'audit test' } }));
    expect(reopenRes.status).toBe(409);

    const { POST: finalize } = await import('@/app/api/workforce/attendance/monthly/finalize/route');
    const finRes = await finalize(req('http://localhost/api/workforce/attendance/monthly/finalize', { method: 'POST', body: { year: YEAR, month: 3 } }));
    expect(finRes.status).toBe(409);

    await prisma.payrollRun.delete({ where: { id: run.id } });
    createdRunIds.splice(createdRunIds.indexOf(run.id), 1);
    expect(await getAttendanceLock(employeeId, day(3, 15))).toBeNull();
  });
});

describe('Mispunch correction keeps the recorded punch (D1) and survives re-import (A1)', () => {
  it('out-time-only correction keeps the in-punch and lands as Present, source manual', async () => {
    await prisma.dailyAttendance.create({
      data: { employeeId, date: day(4, 6), status: 'MissingPunch', inTime: at(4, 6, 9), outTime: null, workingMinutes: 0, source: 'biometric' },
    });
    const correction = await prisma.mispunchCorrection.create({
      data: { employeeId, date: day(4, 6), requestedInTime: null, requestedOutTime: at(4, 6, 18), reason: 'Forgot to punch out', status: 'pending_hr' },
    });

    const { POST: approve } = await import('@/app/api/workforce/mispunch/[id]/approve/route');
    const res = await approve(req(`http://localhost/api/workforce/mispunch/${correction.id}/approve`, { method: 'POST' }), params(correction.id));
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);

    const row = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: day(4, 6) } } });
    expect(row?.inTime?.toISOString()).toBe(at(4, 6, 9).toISOString());
    expect(row?.outTime?.toISOString()).toBe(at(4, 6, 18).toISOString());
    expect(row?.status).toBe('Present');
    expect(row?.workingMinutes).toBe(540);
    expect(row?.source).toBe('manual');
  });

  it('a later biometric import of the same day is skipped as protected, not applied', async () => {
    const { POST: importPost } = await import('@/app/api/biometric/import/route');
    const res = await importPost(
      req('http://localhost/api/biometric/import', {
        method: 'POST',
        body: {
          periodStartDate: `${YEAR}-04-01`,
          source: 'intime',
          fromWhere: 'BIOMETRIC',
          rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: 'Apr-May', day6InTime: 10.3 }],
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conversion.skippedProtected, JSON.stringify(body)).toBeGreaterThan(0);

    const row = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: day(4, 6) } } });
    expect(row?.inTime?.toISOString()).toBe(at(4, 6, 9).toISOString());
    expect(row?.status).toBe('Present');
  });
});

describe('Writers that used to bypass the lock (C3)', () => {
  beforeAll(async () => {
    await prisma.dailyAttendance.update({
      where: { employeeId_date: { employeeId, date: day(4, 6) } },
      data: { lomApprovalStatus: 'pending', lateMinutes: 20, otApprovalStatus: 'pending_hr', otMinutesCalculated: 60 },
    });
    await setSummary(4, 'FROZEN');
  });
  afterAll(async () => {
    await setSummary(4, 'OPEN');
  });

  it('LOM reject → 409', async () => {
    const row = await prisma.dailyAttendance.findUniqueOrThrow({ where: { employeeId_date: { employeeId, date: day(4, 6) } } });
    const { POST } = await import('@/app/api/workforce/attendance/lom/[id]/reject/route');
    const res = await POST(req(`http://localhost/api/workforce/attendance/lom/${row.id}/reject`, { method: 'POST', body: { rejectionReason: 'x' } }), params(row.id));
    expect(res.status).toBe(409);
  });

  it('LOM bulk-approve skips the row as locked', async () => {
    const row = await prisma.dailyAttendance.findUniqueOrThrow({ where: { employeeId_date: { employeeId, date: day(4, 6) } } });
    const { POST } = await import('@/app/api/workforce/attendance/lom/bulk-approve/route');
    const res = await POST(req('http://localhost/api/workforce/attendance/lom/bulk-approve', { method: 'POST', body: { ids: [row.id] } }));
    const body = await res.json();
    expect(body.approved).toBe(0);
    expect(body.results[0].message).toBe('Month is locked');
    const after = await prisma.dailyAttendance.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.lomApprovalStatus).toBe('pending');
  });

  it('OT reject → 409', async () => {
    const row = await prisma.dailyAttendance.findUniqueOrThrow({ where: { employeeId_date: { employeeId, date: day(4, 6) } } });
    const { POST } = await import('@/app/api/workforce/attendance/ot/[id]/reject/route');
    const res = await POST(req(`http://localhost/api/workforce/attendance/ot/${row.id}/reject`, { method: 'POST', body: { rejectionReason: 'x' } }), params(row.id));
    expect(res.status).toBe(409);
  });

  it('mispunch HR approval → 409', async () => {
    const correction = await prisma.mispunchCorrection.create({
      data: { employeeId, date: day(4, 7), requestedInTime: at(4, 7, 9), requestedOutTime: at(4, 7, 18), reason: 'late', status: 'pending_hr' },
    });
    const { POST } = await import('@/app/api/workforce/mispunch/[id]/approve/route');
    const res = await POST(req(`http://localhost/api/workforce/mispunch/${correction.id}/approve`, { method: 'POST' }), params(correction.id));
    expect(res.status).toBe(409);
  });

  it('a shift override for the locked month is refused', async () => {
    const { DELETE } = await import('@/app/api/workforce/shift-plan/route');
    const res = await DELETE(req('http://localhost/api/workforce/shift-plan', { method: 'DELETE', body: { employeeId, date: `${YEAR}-04-06` } }));
    expect(res.status).toBe(409);
  });
});

describe('Payroll lock is the attendance hard lock (C2)', () => {
  it('locking the run freezes the month and reopen is refused', async () => {
    await setSummary(5, 'FINALIZED');
    const run = await createRun(5, 'APPROVED');

    const { POST: lock } = await import('@/app/api/payroll/runs/[id]/lock/route');
    const lockRes = await lock(req(`http://localhost/api/payroll/runs/${run.id}/lock`, { method: 'POST' }), params(run.id));
    expect(lockRes.status, JSON.stringify(await lockRes.clone().json())).toBe(200);

    const summary = await prisma.monthlyAttendanceSummary.findUniqueOrThrow({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 5 } } });
    expect(summary.status).toBe('FROZEN');
    expect(summary.frozenAt).not.toBeNull();

    const { POST: reopen } = await import('@/app/api/workforce/attendance/monthly/reopen/route');
    const reopenRes = await reopen(req('http://localhost/api/workforce/attendance/monthly/reopen', { method: 'POST', body: { year: YEAR, month: 5, employeeId, reason: 'audit test' } }));
    expect(reopenRes.status).toBe(409);
    expect((await reopenRes.json()).error).toMatch(/payroll/i);
  });

  it('reopen works again once payroll is no longer processed, and READY_FOR_PAYROLL reopens too', async () => {
    await prisma.payrollRun.deleteMany({ where: { id: { in: createdRunIds } } });
    createdRunIds.length = 0;
    await setSummary(5, 'READY_FOR_PAYROLL');

    const { POST: reopen } = await import('@/app/api/workforce/attendance/monthly/reopen/route');
    const res = await reopen(req('http://localhost/api/workforce/attendance/monthly/reopen', { method: 'POST', body: { year: YEAR, month: 5, employeeId, reason: 'audit test' } }));
    expect(res.status).toBe(200);
    const summary = await prisma.monthlyAttendanceSummary.findUniqueOrThrow({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 5 } } });
    expect(summary.status).toBe('OPEN');
    expect(summary.reopenReason).toBe('audit test');
  });
});
