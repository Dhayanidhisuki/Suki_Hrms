/**
 * End-to-end verification of the Biometric Attendance import pipeline:
 * 3-source landing table -> DailyAttendance (real in/out time, hours-guess
 * fallback) -> MonthlyAttendanceSummary -> frozen-month guard -> Reopen
 * visibility -> Freeze auto-triggering Payroll recalculation for
 * DRAFT/CALCULATED runs only.
 *
 * Uses company 1 (KUN AEROSPACE, this dev DB's real company) with a
 * TEST-AUTO- employee and year 2099, so it can never collide with real
 * attendance/payroll data. Assumes company 1's company-admin role (id
 * looked up by code, not hardcoded) already has workforce.biometric.view/
 * edit granted — a real, permanent grant made when this feature shipped,
 * not test fixture state, so it is not created/torn down here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteTestEmployee } from './fixtures';

const YEAR = 2099;
let companyId: number;
let auth: { roleId: number; userId: number };
let employeeId: number;
const OLD_EMP_CODE = 'TEST-AUTO-BIO01';

function req(url: string, opts: { method?: string; body?: unknown; companyId?: number } = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-role-id': String(auth.roleId),
    'x-user-id': String(auth.userId),
    'x-company-id': String(opts.companyId ?? companyId),
  });
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

let createdRunIds: number[] = [];

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
  if (!company) throw new Error('No active company found to run this test against.');
  companyId = company.id;

  const adminRole = await prisma.role.findFirst({ where: { companyId, code: 'company-admin', isActive: true } });
  if (!adminRole) throw new Error(`No company-admin role for company ${companyId} — bootstrap it first.`);
  const grants = await prisma.rolePermission.findMany({
    where: { roleId: adminRole.id, permission: { code: { in: ['workforce.biometric.view', 'workforce.biometric.edit'] } } },
  });
  if (grants.length < 2) {
    throw new Error(
      `company-admin role ${adminRole.id} is missing workforce.biometric.view/edit grants — bootstrap-admin needs to be re-run for company ${companyId}.`
    );
  }
  const adminUser = await prisma.user.findFirst({ where: { companyId, roleId: adminRole.id, isActive: true, deletedAt: null } });
  if (!adminUser) throw new Error(`No active user with role ${adminRole.id} for company ${companyId}.`);
  auth = { roleId: adminRole.id, userId: adminUser.id };

  const [department, designation, employeeType] = await Promise.all([
    prisma.department.findFirst({ where: { deletedAt: null } }),
    prisma.designation.findFirst({ where: { deletedAt: null } }),
    prisma.employeeType.findFirst({ where: { deletedAt: null } }),
  ]);
  if (!department || !designation || !employeeType) throw new Error('Missing base master data.');

  const { POST: createEmployee } = await import('@/app/api/employees/route');
  const empRes = await createEmployee(
    req('http://localhost/api/employees', {
      method: 'POST',
      body: {
        companyId,
        departmentId: department.id,
        designationId: designation.id,
        employeeTypeId: employeeType.id,
        firstName: 'Automated',
        lastName: 'BioTest',
        oldEmployeeCode: OLD_EMP_CODE,
        joinDate: '2026-01-01',
      },
    })
  );
  expect(empRes.status).toBe(201);
  const empBody = await empRes.json();
  employeeId = empBody.id;
});

afterAll(async () => {
  await prisma.dailyAttendance.deleteMany({ where: { employeeId, date: { gte: new Date(Date.UTC(YEAR, 0, 1)), lt: new Date(Date.UTC(YEAR + 1, 0, 1)) } } });
  await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId, year: YEAR } });
  await prisma.biometricAttendanceImport.deleteMany({ where: { companyId, empIdRaw: OLD_EMP_CODE, year: YEAR } });
  if (createdRunIds.length) {
    // Freezing cascades calculatePayrollRun across every real employee in
    // the company (correct feature behavior), which creates PayrollLine
    // rows against these throwaway runs — must clear those FKs first.
    await prisma.payrollLineComponent.deleteMany({ where: { payrollLine: { payrollRunId: { in: createdRunIds } } } });
    await prisma.payrollLine.deleteMany({ where: { payrollRunId: { in: createdRunIds } } });
    await prisma.payrollRun.deleteMany({ where: { id: { in: createdRunIds } } });
  }
  await deleteTestEmployee(employeeId);
});

describe('Biometric attendance import -> DailyAttendance/MonthlyAttendanceSummary', () => {
  it('imports hours, then in-time, then out-time for the same wage period, merging into one landing row', async () => {
    const { POST: importPost } = await import('@/app/api/biometric/import/route');

    const hoursRes = await importPost(
      req('http://localhost/api/biometric/import', {
        method: 'POST',
        body: {
          periodStartDate: '2099-02-01',
          source: 'hours',
          fromWhere: 'BIOMETRIC',
          rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: 'Feb-Mar', total: 216, totalLom: 0, totalOtHrs: 0, day2: 9, day3: 0 }],
        },
      })
    );
    expect(hoursRes.status).toBe(201);
    const hoursBody = await hoursRes.json();
    expect(hoursBody.unmatched).toBe(0);

    const inRes = await importPost(
      req('http://localhost/api/biometric/import', {
        method: 'POST',
        body: {
          periodStartDate: '2099-02-01',
          source: 'intime',
          fromWhere: 'BIOMETRIC',
          rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: 'Feb-Mar', day2InTime: 9.05, day5InTime: 9.0, day6InTime: 22.0 }],
        },
      })
    );
    expect(inRes.status).toBe(201);

    const outRes = await importPost(
      req('http://localhost/api/biometric/import', {
        method: 'POST',
        body: {
          periodStartDate: '2099-02-01',
          source: 'outtime',
          fromWhere: 'BIOMETRIC',
          rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: 'Feb-Mar', day2OutTime: 12.05, day5OutTime: 18.0, day6OutTime: 2.0 }],
        },
      })
    );
    expect(outRes.status).toBe(201);

    const landing = await prisma.biometricAttendanceImport.findFirst({ where: { companyId, empIdRaw: OLD_EMP_CODE, year: YEAR } });
    expect(landing?.matchedEmployeeId).toBe(employeeId);
    expect(Number(landing?.day2)).toBe(9);
    expect(Number(landing?.day2InTime)).toBe(9.05);
    expect(Number(landing?.day2OutTime)).toBe(12.05);
  });

  it('day2: a real in/out duration (3h) overrides the hours-guess (9h would be Present) -> HalfDay', async () => {
    const day = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 2)) } } });
    expect(day?.status).toBe('HalfDay');
    expect(day?.workingMinutes).toBe(180);
    expect(day?.source).toBe('biometric');
    expect(day?.inTime).not.toBeNull();
    expect(day?.outTime).not.toBeNull();
  });

  it('day3: hours=0, no punch data -> Absent', async () => {
    const day = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 3)) } } });
    expect(day?.status).toBe('Absent');
  });

  it('day4: no hours and no punch data at all -> no DailyAttendance row is created', async () => {
    const day = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 4)) } } });
    expect(day).toBeNull();
  });

  it('day5: no hours value, only in/out -> Present derived purely from duration (9h)', async () => {
    const day = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 5)) } } });
    expect(day?.status).toBe('Present');
    expect(day?.workingMinutes).toBe(540);
  });

  it('day6: overnight punch (22:00 -> 02:00) is treated as crossing midnight -> 4h duration -> HalfDay', async () => {
    const day = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 6)) } } });
    expect(day?.status).toBe('HalfDay');
    expect(day?.workingMinutes).toBe(240);
  });

  it('refreshes MonthlyAttendanceSummary counts while leaving status OPEN', async () => {
    const summary = await prisma.monthlyAttendanceSummary.findUnique({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 2 } } });
    expect(summary?.status).toBe('OPEN');
    expect(Number(summary!.presentDays) + Number(summary!.absentDays)).toBeGreaterThan(0);
  });
});

describe('Frozen-month guard', () => {
  it('rejects (skips, reports, does not overwrite) a biometric push into an already-FROZEN month', async () => {
    const summary = await prisma.monthlyAttendanceSummary.findUnique({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 2 } } });
    await prisma.monthlyAttendanceSummary.update({ where: { id: summary!.id }, data: { status: 'FROZEN', frozenAt: new Date() } });

    const { POST: importPost } = await import('@/app/api/biometric/import/route');
    const res = await importPost(
      req('http://localhost/api/biometric/import', {
        method: 'POST',
        body: {
          periodStartDate: '2099-02-01',
          source: 'hours',
          fromWhere: 'BIOMETRIC',
          rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: 'Feb-Mar', day2: 1 }],
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conversion.skippedFrozen).toBeGreaterThan(0);

    const day2 = await prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: new Date(Date.UTC(2099, 1, 2)) } } });
    expect(day2?.workingMinutes).toBe(180); // unchanged from the earlier 3h push
  });
});

describe('Reopen — visible from GET /api/workforce/attendance/monthly', () => {
  it('reopening a frozen month is reflected in the monthly grid response (who + why)', async () => {
    const { POST: reopenPost } = await import('@/app/api/workforce/attendance/monthly/reopen/route');
    const reopenRes = await reopenPost(
      req('http://localhost/api/workforce/attendance/monthly/reopen', { method: 'POST', body: { year: YEAR, month: 2, reason: 'Verification test reopen' } })
    );
    expect(reopenRes.status).toBe(200);

    const { GET: monthlyGet } = await import('@/app/api/workforce/attendance/monthly/route');
    const monthlyRes = await monthlyGet(req(`http://localhost/api/workforce/attendance/monthly?year=${YEAR}&month=2`));
    expect(monthlyRes.status).toBe(200);
    const monthlyBody = await monthlyRes.json();
    const empRow = monthlyBody.data.find((e: { employeeId: number }) => e.employeeId === employeeId);
    expect(empRow.summary.reopenReason).toBe('Verification test reopen');
    expect(empRow.summary.reopenedByName).toBeTruthy();
    expect(empRow.summary.reopenedAt).toBeTruthy();
  });
});

describe('Freeze auto-triggers Payroll for DRAFT/CALCULATED runs, never APPROVED/LOCKED', () => {
  it('recalculates a DRAFT run for the frozen month', async () => {
    await prisma.monthlyAttendanceSummary.update({
      where: { employeeId_year_month: { employeeId, year: YEAR, month: 2 } },
      data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedByUserId: auth.userId },
    });
    const draftRun = await prisma.payrollRun.create({ data: { companyId, year: YEAR, month: 2, status: 'DRAFT' } });
    createdRunIds.push(draftRun.id);

    const { POST: freezePost } = await import('@/app/api/workforce/attendance/monthly/freeze/route');
    const res = await freezePost(req('http://localhost/api/workforce/attendance/monthly/freeze', { method: 'POST', body: { year: YEAR, month: 2 } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payrollRecalculated).toBe(true);

    const after = await prisma.payrollRun.findUnique({ where: { id: draftRun.id } });
    expect(after?.status).toBe('CALCULATED');
    expect(after?.calculatedAt).not.toBeNull();
  });

  it('never touches an APPROVED/LOCKED run, even for the same month being frozen', async () => {
    const approvedRun = await prisma.payrollRun.create({
      data: { companyId, year: YEAR, month: 4, status: 'APPROVED', approvedAt: new Date(), approvedByUserId: auth.userId },
    });
    createdRunIds.push(approvedRun.id);
    await prisma.monthlyAttendanceSummary.upsert({
      where: { employeeId_year_month: { employeeId, year: YEAR, month: 4 } },
      update: { status: 'FINALIZED' },
      create: { employeeId, year: YEAR, month: 4, totalWorkingDays: 28, status: 'FINALIZED' },
    });

    const { POST: freezePost } = await import('@/app/api/workforce/attendance/monthly/freeze/route');
    const res = await freezePost(req('http://localhost/api/workforce/attendance/monthly/freeze', { method: 'POST', body: { year: YEAR, month: 4 } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payrollRecalculated).toBe(false);

    const after = await prisma.payrollRun.findUnique({ where: { id: approvedRun.id } });
    expect(after?.status).toBe('APPROVED');
    expect(after?.calculatedAt).toBeNull();
  });
});

describe('Cross-tenant isolation', () => {
  it('a different (nonexistent) companyId sees none of this data', async () => {
    const { GET: importGet } = await import('@/app/api/biometric/import/route');
    const res = await importGet(req('http://localhost/api/biometric/import?date=2099-02-02', { companyId: 999999 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});
