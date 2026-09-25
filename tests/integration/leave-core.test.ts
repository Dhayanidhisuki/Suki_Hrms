/**
 * Leave core (2026-09-25) against the real dev database:
 *
 *   #1  paid leave skips the Sunday inside the range and debits working days
 *   #2  half-day → HalfDay, 0.5 debit, punches merge on import, no conflict
 *   #3  submission refused on a punched date; approval WORKED_DAY
 *   #4/5 punch on an approved full-day leave → conflict; HR 'present' returns
 *        the day; 'keep_leave' does not re-flag on re-import
 *   sandwich: unpaid Fri→Mon writes Sat/Sun as LOP
 *   cancel restores the days (Absent / WeeklyOff), refunds what is still debited
 *   summary counts half-day leave as 0.5 leave, not absent
 *   double HR approval → 409
 *
 * Year 2098, own employee and two temporary leave types. June 2098 starts on
 * a Sunday (Sundays 1, 8, 15, 22, 29); August 2098 starts on a Friday
 * (Sat 2, Sun 3, Mon 4).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee } from './fixtures';

const YEAR = 2098;
const OLD_EMP_CODE = 'TEST-AUTO-LEAVE01';
const PAID_CODE = 'TSTPL98';
const UNPAID_CODE = 'TSTLOP98';
const NEEDED_PERMISSIONS = ['workforce.leave.view', 'workforce.leave.edit', 'workforce.leave.approve', 'workforce.biometric.edit'];

let companyId: number;
let auth: { roleId: number; userId: number };
let employeeId: number;
let paidTypeId: number;
let unpaidTypeId: number;
const tempGrantIds: number[] = [];

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
const ymd = (m: number, d: number) => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

async function apply(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/workforce/leave/applications/route');
  return POST(req('http://localhost/api/workforce/leave/applications', { method: 'POST', body: { employeeId, ...body } }));
}
async function toHr(id: number) {
  await prisma.leaveApplication.update({ where: { id }, data: { status: 'pending_hr' } });
}
async function approve(id: number) {
  const { POST } = await import('@/app/api/workforce/leave/applications/[id]/approve/route');
  return POST(req(`http://localhost/api/workforce/leave/applications/${id}/approve`, { method: 'POST' }), params(id));
}
async function cancel(id: number) {
  const { POST } = await import('@/app/api/workforce/leave/applications/[id]/cancel/route');
  return POST(req(`http://localhost/api/workforce/leave/applications/${id}/cancel`, { method: 'POST' }), params(id));
}
async function importDay(month: number, d: number, inTime: number, outTime?: number) {
  const { POST } = await import('@/app/api/biometric/import/route');
  const label = `Leave-${month}`;
  const period = `${YEAR}-${String(month).padStart(2, '0')}-01`;
  const inRes = await POST(req('http://localhost/api/biometric/import', { method: 'POST', body: { periodStartDate: period, source: 'intime', fromWhere: 'BIOMETRIC', rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: label, [`day${d}InTime`]: inTime }] } }));
  expect(inRes.status).toBe(201);
  const inBody = await inRes.json();
  if (outTime === undefined) return inBody;
  const outRes = await POST(req('http://localhost/api/biometric/import', { method: 'POST', body: { periodStartDate: period, source: 'outtime', fromWhere: 'BIOMETRIC', rows: [{ empIdRaw: OLD_EMP_CODE, year: YEAR, attForMonth: label, [`day${d}OutTime`]: outTime }] } }));
  expect(outRes.status).toBe(201);
  return outRes.json();
}
async function balance() {
  const b = await prisma.leaveBalance.findUnique({ where: { employeeId_leaveMasterId_year: { employeeId, leaveMasterId: paidTypeId, year: YEAR } } });
  return Number(b?.closingBalance ?? 0);
}
async function row(m: number, d: number) {
  return prisma.dailyAttendance.findUnique({ where: { employeeId_date: { employeeId, date: day(m, d) } } });
}

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
  if (!company) throw new Error('No active company.');
  companyId = company.id;
  const adminRole = await prisma.role.findFirst({ where: { companyId, code: 'company-admin', isActive: true } });
  if (!adminRole) throw new Error('No company-admin role.');
  const adminUser = await prisma.user.findFirst({ where: { companyId, roleId: adminRole.id, isActive: true, deletedAt: null } });
  if (!adminUser) throw new Error('No admin user.');
  auth = { roleId: adminRole.id, userId: adminUser.id };

  for (const code of NEEDED_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({ where: { code } });
    if (!permission) throw new Error(`Permission ${code} is not seeded.`);
    const existing = await prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: auth.roleId, permissionId: permission.id } } });
    if (!existing) tempGrantIds.push((await prisma.rolePermission.create({ data: { roleId: auth.roleId, permissionId: permission.id } })).id);
  }

  // Leftovers from an aborted run.
  await prisma.leaveMaster.deleteMany({ where: { code: { in: [PAID_CODE, UNPAID_CODE] }, leaveApplications: { none: {} } } });

  const paid = await prisma.leaveMaster.create({ data: { code: PAID_CODE, name: 'Test paid leave 2098', defaultAnnualDays: 12, accrualType: 'YEARLY', isPaid: true, halfDayAllowed: true } });
  const unpaid = await prisma.leaveMaster.create({ data: { code: UNPAID_CODE, name: 'Test LOP 2098', defaultAnnualDays: 0, accrualType: 'YEARLY', isPaid: false, countSandwichedNonWorking: true } });
  paidTypeId = paid.id;
  unpaidTypeId = unpaid.id;

  employeeId = (await createTestEmployee(auth, { companyId, oldEmployeeCode: OLD_EMP_CODE, lastName: 'LeaveCore' })).id;
  await prisma.leaveBalance.create({ data: { employeeId, leaveMasterId: paidTypeId, year: YEAR, openingBalance: 10, accrued: 0, availed: 0, closingBalance: 10 } });
});

afterAll(async () => {
  await prisma.dailyAttendance.deleteMany({ where: { employeeId } });
  await prisma.leaveApplication.deleteMany({ where: { employeeId } });
  await prisma.leaveBalance.deleteMany({ where: { employeeId } });
  await prisma.monthlyAttendanceSummary.deleteMany({ where: { employeeId } });
  await prisma.biometricAttendanceImport.deleteMany({ where: { companyId, empIdRaw: OLD_EMP_CODE, year: YEAR } });
  await prisma.leaveMaster.deleteMany({ where: { id: { in: [paidTypeId, unpaidTypeId].filter(Boolean) } } });
  if (tempGrantIds.length) await prisma.rolePermission.deleteMany({ where: { id: { in: tempGrantIds } } });
  await deleteTestEmployee(employeeId);
});

describe('#1 paid leave over a Sunday', () => {
  let appId: number;

  it('applies Sat 7 Jun → Mon 9 Jun as 2 working days, Sunday skipped', async () => {
    const res = await apply({ leaveMasterId: paidTypeId, fromDate: ymd(6, 7), toDate: ymd(6, 9), reason: 'test' });
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    const body = await res.json();
    appId = body.id;
    expect(Number(body.numberOfDays)).toBe(2);
    expect(body.plan.skippedDates).toEqual([{ date: ymd(6, 8), reason: 'WeeklyOff' }]);
  });

  it('HR approval debits 2, writes Leave on 7 and 9 only, links the rows', async () => {
    await toHr(appId);
    const res = await approve(appId);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await balance()).toBe(8);
    expect((await row(6, 7))?.status).toBe('Leave');
    expect((await row(6, 7))?.leaveApplicationId).toBe(appId);
    expect((await row(6, 7))?.leaveDayKind).toBe('LEAVE');
    expect(await row(6, 8)).toBeNull();
    expect((await row(6, 9))?.status).toBe('Leave');
  });

  it('a second HR approval is refused', async () => {
    const res = await approve(appId);
    expect(res.status).toBe(409);
  });

  it('cancel restores both days to Absent and refunds 2', async () => {
    const res = await cancel(appId);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await balance()).toBe(10);
    expect((await row(6, 7))?.status).toBe('Absent');
    expect((await row(6, 7))?.leaveApplicationId).toBeNull();
    const app = await prisma.leaveApplication.findUniqueOrThrow({ where: { id: appId } });
    expect(app.status).toBe('cancelled');
    expect(app.cancelledAt).not.toBeNull();
  });
});

describe('#3 leave over a worked day', () => {
  it('submission is refused when the date already has a punch-in', async () => {
    await prisma.dailyAttendance.create({ data: { employeeId, date: day(6, 10), status: 'Present', inTime: at(6, 10, 9), outTime: at(6, 10, 18), workingMinutes: 540, source: 'biometric' } });
    const res = await apply({ leaveMasterId: paidTypeId, fromDate: ymd(6, 10), toDate: ymd(6, 11), reason: 'test' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/punched/i);
  });

  it('HR approval is refused when a punch arrived after submission (WORKED_DAY)', async () => {
    const res = await apply({ leaveMasterId: paidTypeId, fromDate: ymd(6, 11), toDate: ymd(6, 11), reason: 'test' });
    expect(res.status).toBe(201);
    const appId = (await res.json()).id;
    await prisma.dailyAttendance.create({ data: { employeeId, date: day(6, 11), status: 'MissingPunch', inTime: at(6, 11, 9), source: 'biometric' } });
    await toHr(appId);
    const approveRes = await approve(appId);
    expect(approveRes.status).toBe(409);
    expect((await approveRes.json()).reason).toBe('WORKED_DAY');
    await prisma.leaveApplication.update({ where: { id: appId }, data: { status: 'cancelled' } });
  });
});

describe('#2 half-day leave', () => {
  let appId: number;

  it('applies and approves as HalfDay with 0.5 debited', async () => {
    const res = await apply({ leaveMasterId: paidTypeId, fromDate: ymd(6, 16), toDate: ymd(6, 16), isHalfDay: true, reason: 'test' });
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    appId = (await res.json()).id;
    await toHr(appId);
    expect((await approve(appId)).status).toBe(200);
    expect(await balance()).toBe(9.5);
    const r = await row(6, 16);
    expect(r?.status).toBe('HalfDay');
    expect(r?.leaveDayKind).toBe('HALF');
  });

  it('punches for the worked half merge into the day — no conflict', async () => {
    const body = await importDay(6, 16, 9.0, 13.1);
    expect(body.conversion.conflicts).toBe(0);
    const r = await row(6, 16);
    expect(r?.status).toBe('HalfDay');
    expect(r?.inTime?.toISOString()).toBe(at(6, 16, 9).toISOString());
    expect(r?.workingMinutes).toBe(250);
    expect(r?.leaveConflictInTime).toBeNull();
    expect(r?.leaveApplicationId).toBe(appId);
  });

  it('summary counts 0.5 present + 0.5 leave, not absent', async () => {
    const s = await prisma.monthlyAttendanceSummary.findUniqueOrThrow({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 6 } } });
    expect(Number(s.leaveDays)).toBe(0.5);
    expect(Number(s.otherLeaveDays)).toBe(0.5);
    // June rows: 10 Present, 11 MissingPunch (absent), 7 & 9 Absent, 16 HalfDay-leave
    expect(Number(s.absentDays)).toBe(3);
    expect(Number(s.presentDays)).toBe(1.5);
  });
});

describe('#4/#5 punch on an approved full-day leave', () => {
  let appId: number;

  it('is recorded as a conflict, the day stays Leave', async () => {
    const res = await apply({ leaveMasterId: paidTypeId, fromDate: ymd(7, 8), toDate: ymd(7, 10), reason: 'test' });
    expect(res.status).toBe(201);
    appId = (await res.json()).id;
    await toHr(appId);
    expect((await approve(appId)).status).toBe(200);
    expect(await balance()).toBe(6.5);

    const body = await importDay(7, 9, 9.0, 18.0);
    expect(body.conversion.skippedProtected).toBeGreaterThan(0);
    const r = await row(7, 9);
    expect(r?.status).toBe('Leave');
    expect(r?.leaveConflictInTime?.toISOString()).toBe(at(7, 9, 9).toISOString());
    expect(r?.leaveConflictOutTime?.toISOString()).toBe(at(7, 9, 18).toISOString());
    expect(r?.leaveConflictDecision).toBeNull();

    const { GET } = await import('@/app/api/workforce/leave/conflicts/route');
    const list = await (await GET(req('http://localhost/api/workforce/leave/conflicts'))).json();
    expect(list.data.some((c: { id: number }) => c.id === r?.id)).toBe(true);
  });

  it("HR 'present' returns the day: balance +1, row Present, application 2 days", async () => {
    const r = await row(7, 9);
    const { POST } = await import('@/app/api/workforce/leave/conflicts/[attendanceId]/resolve/route');
    const res = await POST(
      req(`http://localhost/api/workforce/leave/conflicts/${r!.id}/resolve`, { method: 'POST', body: { decision: 'present', note: 'came in for audit' } }),
      { params: Promise.resolve({ attendanceId: String(r!.id) }) }
    );
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await balance()).toBe(7.5);
    const after = await row(7, 9);
    expect(after?.status).toBe('Present');
    expect(after?.leaveApplicationId).toBeNull();
    expect(after?.inTime?.toISOString()).toBe(at(7, 9, 9).toISOString());
    expect(after?.leaveConflictDecision).toBe('present');
    const app = await prisma.leaveApplication.findUniqueOrThrow({ where: { id: appId } });
    expect(Number(app.numberOfDays)).toBe(2);
    expect(Number(app.daysReversed)).toBe(1);
    expect(app.status).toBe('approved');
    expect((await row(7, 8))?.status).toBe('Leave');
    expect((await row(7, 10))?.status).toBe('Leave');
  });

  it("'keep_leave' keeps the day and a re-import does not re-flag", async () => {
    await importDay(7, 10, 9.0, 18.0);
    const r = await row(7, 10);
    expect(r?.leaveConflictInTime).not.toBeNull();
    const { POST } = await import('@/app/api/workforce/leave/conflicts/[attendanceId]/resolve/route');
    const res = await POST(
      req(`http://localhost/api/workforce/leave/conflicts/${r!.id}/resolve`, { method: 'POST', body: { decision: 'keep_leave' } }),
      { params: Promise.resolve({ attendanceId: String(r!.id) }) }
    );
    expect(res.status).toBe(200);
    expect((await row(7, 10))?.status).toBe('Leave');
    expect(await balance()).toBe(7.5);

    const again = await importDay(7, 10, 9.0, 18.0);
    expect(again.conversion.conflicts).toBe(0);
    expect((await row(7, 10))?.leaveConflictDecision).toBe('keep_leave');
  });

  it('cancel of the remaining leave refunds 2 (not 3) and restores 8 and 10', async () => {
    const res = await cancel(appId);
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect(await balance()).toBe(9.5);
    expect((await row(7, 8))?.status).toBe('Absent');
    // 10 Jul had a kept-leave conflict punch; restore applies it.
    expect((await row(7, 10))?.status).toBe('Present');
    expect((await row(7, 9))?.status).toBe('Present');
  });
});

describe('unpaid leave sandwich', () => {
  let appId: number;

  it('Fri 1 Aug → Mon 4 Aug writes the Sunday as LOP (SANDWICH), no ledger touched', async () => {
    // Saturday is a working day for this employee (Sunday-only weekly off).
    const res = await apply({ leaveMasterId: unpaidTypeId, fromDate: ymd(8, 1), toDate: ymd(8, 4), reason: 'test' });
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    const body = await res.json();
    appId = body.id;
    expect(Number(body.numberOfDays)).toBe(4);
    expect(body.plan.sandwichDates).toEqual([ymd(8, 3)]);
    await toHr(appId);
    expect((await approve(appId)).status).toBe(200);
    expect((await row(8, 1))?.status).toBe('LOP');
    expect((await row(8, 2))?.leaveDayKind).toBe('LEAVE');
    expect((await row(8, 3))?.leaveDayKind).toBe('SANDWICH');
    expect((await row(8, 3))?.status).toBe('LOP');
    expect((await row(8, 4))?.status).toBe('LOP');
    expect(await balance()).toBe(9.5); // paid balance untouched
    const s = await prisma.monthlyAttendanceSummary.findUniqueOrThrow({ where: { employeeId_year_month: { employeeId, year: YEAR, month: 8 } } });
    expect(Number(s.lopDays)).toBe(4);
  });

  it("'present' on Monday un-sandwiches the weekend back to WeeklyOff / Absent", async () => {
    await importDay(8, 4, 9.0, 18.0);
    const r = await row(8, 4);
    const { POST } = await import('@/app/api/workforce/leave/conflicts/[attendanceId]/resolve/route');
    const res = await POST(
      req(`http://localhost/api/workforce/leave/conflicts/${r!.id}/resolve`, { method: 'POST', body: { decision: 'present' } }),
      { params: Promise.resolve({ attendanceId: String(r!.id) }) }
    );
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(200);
    expect((await row(8, 4))?.status).toBe('Present');
    expect((await row(8, 3))?.status).toBe('WeeklyOff'); // Sunday no longer sandwiched
    expect((await row(8, 3))?.leaveApplicationId).toBeNull();
    expect((await row(8, 2))?.status).toBe('LOP'); // Saturday leave day stands
    expect((await row(8, 1))?.status).toBe('LOP');
    const app = await prisma.leaveApplication.findUniqueOrThrow({ where: { id: appId } });
    expect(Number(app.numberOfDays)).toBe(2);
    expect(Number(app.daysReversed)).toBe(2);
  });
});
