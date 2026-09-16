/**
 * BRD 01 §8 lifecycle transitions and §15/§17/§19 dated job history through
 * the services and the /lifecycle routes, in the TESTCO tenant.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { transition, TransitionError } from '@/lib/employee/lifecycle';
import { changeJob, JobChangeError, resolveJob, resolvePeriod, resolveManagers, requiredNoticeDaysOn, utcDay } from '@/lib/employee/resolveJob';
import { testTenant, req, ctx, createEmployee, purgeEmployee, resetCodePolicy, baseMasters, type TestAuth } from './employee-helpers';

let admin: TestAuth;
let companyId: number;
const employees: number[] = [];
let emp: number;
let manager: number;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeAll(async () => {
  const t = await testTenant();
  admin = t.adminAuth;
  companyId = t.companyId;
  manager = (await createEmployee(admin, { firstName: 'Line', lastName: 'Manager', probationPeriodMonths: 0 })).id;
  emp = (await createEmployee(admin, { firstName: 'Life', lastName: 'Cycle', probationPeriodMonths: 6, joinDate: '2026-01-01' })).id;
  employees.push(manager, emp);
});

afterAll(async () => {
  for (const id of employees.reverse()) await purgeEmployee(id);
  await resetCodePolicy(companyId);
});

const actor = () => ({ userId: admin.userId });

describe('lifecycle transitions (§8.2)', () => {
  it('starts in PROBATION and confirms through the service, writing status + history + audit', async () => {
    expect((await prisma.employee.findUnique({ where: { id: emp } }))?.lifecycleState).toBe('PROBATION');

    const result = await transition(companyId, emp, 'CONFIRMED', { trigger: 'CONFIRMATION', actor: actor(), reason: 'test' });
    expect(result.fromState).toBe('PROBATION');
    expect(result.toState).toBe('CONFIRMED');
    expect(result.legacyStatus).toBe('active');

    const row = await prisma.employee.findUnique({ where: { id: emp }, select: { lifecycleState: true, status: true } });
    expect(row).toEqual({ lifecycleState: 'CONFIRMED', status: 'active' });

    const last = await prisma.employeeStateTransition.findFirst({ where: { employeeId: emp }, orderBy: { id: 'desc' } });
    expect(last).toMatchObject({ fromState: 'PROBATION', toState: 'CONFIRMED', trigger: 'CONFIRMATION', reason: 'test' });

    const audit = await prisma.auditLog.findFirst({ where: { companyId, entityType: 'Employee', entityId: emp, action: 'STATE_CHANGE' }, orderBy: { id: 'desc' } });
    expect(audit).not.toBeNull();
  });

  it('rejects a transition the table does not permit with the BRD message', async () => {
    await expect(transition(companyId, emp, 'DRAFT', { trigger: 'X', actor: actor() })).rejects.toThrow('Transition not permitted from CONFIRMED to DRAFT');
    await expect(transition(companyId, emp, 'CONFIRMED', { trigger: 'X', actor: actor() })).rejects.toBeInstanceOf(TransitionError);
  });

  it('LONG_LEAVE maps to on-leave and resumes only to the prior state', async () => {
    await transition(companyId, emp, 'LONG_LEAVE', { trigger: 'LEAVE', actor: actor() });
    expect((await prisma.employee.findUnique({ where: { id: emp } }))?.status).toBe('on-leave');
    await expect(transition(companyId, emp, 'PROBATION', { trigger: 'RESUME', actor: actor() })).rejects.toThrow('prior state was CONFIRMED');
    await transition(companyId, emp, 'CONFIRMED', { trigger: 'RESUME', actor: actor() });
    expect((await prisma.employee.findUnique({ where: { id: emp } }))?.status).toBe('active');
  });

  it('the /lifecycle routes expose the state, allowed targets and a 409 on a bad target', async () => {
    const { GET } = await import('@/app/api/employees/[id]/lifecycle/route');
    const res = await GET(req(`http://localhost/api/employees/${emp}/lifecycle`, { auth: admin }), ctx(emp));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.state).toBe('CONFIRMED');
    expect(json.allowedTargets.sort()).toEqual(['LONG_LEAVE', 'ON_NOTICE', 'SUSPENDED']);
    expect(json.history.length).toBeGreaterThanOrEqual(5);

    const { POST } = await import('@/app/api/employees/[id]/lifecycle/transition/route');
    const bad = await POST(req(`http://localhost/api/employees/${emp}/lifecycle/transition`, { method: 'POST', auth: admin, body: { toState: 'PROBATION' } }), ctx(emp));
    expect(bad.status).toBe(409);
    const ok = await POST(
      req(`http://localhost/api/employees/${emp}/lifecycle/transition`, { method: 'POST', auth: admin, body: { toState: 'SUSPENDED', referenceNo: 'SUSP/1', effectiveDate: '2026-03-01' } }),
      ctx(emp)
    );
    expect(ok.status).toBe(200);
    await transition(companyId, emp, 'CONFIRMED', { trigger: 'REINSTATED', actor: actor() });
  });
});

describe('confirmation action (§8.2 rule 5 wired into the existing approve route)', () => {
  it('POST /confirmation/approve sets the confirmation date and moves PROBATION → CONFIRMED', async () => {
    const probationer = (await createEmployee(admin, { firstName: 'Probation', lastName: 'Approve', probationPeriodMonths: 3, joinDate: '2026-01-01' })).id;
    employees.push(probationer);
    await prisma.jobInfo.updateMany({ where: { employeeId: probationer, effectiveTo: null }, data: { managerRecommendation: 'recommend' } });

    const { POST } = await import('@/app/api/employees/[id]/confirmation/approve/route');
    const res = await POST(req(`http://localhost/api/employees/${probationer}/confirmation/approve`, { method: 'POST', auth: admin, body: { remarks: 'ok' } }), ctx(probationer));
    expect(res.status).toBe(200);
    expect((await res.json()).lifecycleState).toBe('CONFIRMED');

    const row = await prisma.employee.findUnique({ where: { id: probationer }, select: { lifecycleState: true, jobInfos: { where: { effectiveTo: null }, select: { confirmationDate: true } } } });
    expect(row?.lifecycleState).toBe('CONFIRMED');
    expect(row?.jobInfos[0].confirmationDate).not.toBeNull();
    const last = await prisma.employeeStateTransition.findFirst({ where: { employeeId: probationer }, orderBy: { id: 'desc' } });
    expect(last).toMatchObject({ fromState: 'PROBATION', toState: 'CONFIRMED', trigger: 'CONFIRMATION' });
  });
});

describe('dated job history (§15 / §17 / §19)', () => {
  it('changeJob closes the open row at D-1, inserts the new row and resolves by date', async () => {
    const m = await baseMasters();
    const before = await prisma.jobInfo.findFirst({ where: { employeeId: emp, effectiveTo: null } });
    expect(before?.departmentId).toBe(m.department.id);

    const row = await changeJob({
      companyId,
      employeeId: emp,
      effectiveFrom: d('2026-05-16'),
      changeReason: 'TRANSFER',
      changeReference: 'TR/2026/1',
      changes: { departmentId: m.department2.id },
      reporting: { primaryManagerId: manager },
      actor: actor(),
      isAdmin: true,
      today: d('2026-05-20'),
    });
    expect(row.effectiveTo).toBeNull();
    expect(row.changeReason).toBe('TRANSFER');

    const closed = await prisma.jobInfo.findUnique({ where: { id: before!.id } });
    expect(closed?.effectiveTo?.toISOString().slice(0, 10)).toBe('2026-05-15');

    expect((await resolveJob(emp, d('2026-05-12')))?.departmentId).toBe(m.department.id);
    expect((await resolveJob(emp, d('2026-05-16')))?.departmentId).toBe(m.department2.id);

    const split = await resolvePeriod(emp, d('2026-05-01'), d('2026-05-31'), 'DAY_WEIGHTED');
    expect(split.map((s) => s.days)).toEqual([15, 16]);
    expect((await resolvePeriod(emp, d('2026-05-01'), d('2026-05-31')))[0].jobInfo.departmentId).toBe(m.department2.id);

    // Reporting: pointer updated and history written; the old date still resolves to no manager.
    expect((await prisma.employee.findUnique({ where: { id: emp } }))?.reportingManagerId).toBe(manager);
    expect((await resolveManagers(emp, d('2026-05-16')))?.primaryManagerId).toBe(manager);
    expect((await resolveManagers(emp, d('2026-05-01')))?.primaryManagerId).toBeNull();
  });

  it('enforces §15.1 back-dating: non-admin forward only, admin within the allowance', async () => {
    const m = await baseMasters();
    await expect(
      changeJob({ companyId, employeeId: emp, effectiveFrom: d('2026-05-20'), changeReason: 'CORRECTION', changes: { departmentId: m.department.id }, actor: actor(), isAdmin: false, today: d('2026-06-01') })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      changeJob({ companyId, employeeId: emp, effectiveFrom: d('2026-05-20'), changeReason: 'TRANSFER', changes: { locationId: null }, actor: actor(), isAdmin: true, today: d('2026-08-01') })
    ).rejects.toBeInstanceOf(JobChangeError);
    await expect(
      changeJob({ companyId, employeeId: emp, effectiveFrom: d('2026-05-01'), changeReason: 'CORRECTION', changes: {}, actor: actor(), isAdmin: true, today: d('2026-05-20') })
    ).rejects.toThrow('earlier than the effective date of the current job record');
  });

  it('notice period: resolved from grade default / policy and readable on any date', async () => {
    const current = await prisma.jobInfo.findFirst({ where: { employeeId: emp, effectiveTo: null } });
    const days = await requiredNoticeDaysOn(emp, utcDay(new Date()));
    // TESTCO has no F&F config and the base grade carries no default → null is a legitimate answer;
    // an explicit forward-dated change must then be honoured.
    expect(days).toBe(current?.noticePeriodDays ?? null);

    const row = await changeJob({
      companyId,
      employeeId: emp,
      effectiveFrom: d('2026-07-01'),
      changeReason: 'POLICY',
      changes: { noticePeriodDays: 60 },
      actor: actor(),
      isAdmin: true,
      today: d('2026-06-01'),
    });
    expect(row.noticePeriodDays).toBe(60);
    expect(row.noticePeriodSource).toBe('MANUAL');
    expect(await requiredNoticeDaysOn(emp, d('2026-07-15'))).toBe(60);
    expect(await requiredNoticeDaysOn(emp, d('2026-06-15'))).toBe(days);
  });

  it('job-history route lists the rows newest first with the reporting line', async () => {
    const { GET } = await import('@/app/api/employees/[id]/lifecycle/job-history/route');
    const res = await GET(req(`http://localhost/api/employees/${emp}/lifecycle/job-history`, { auth: admin }), ctx(emp));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBe(3);
    expect(json.data[0].isCurrent).toBe(true);
    expect(json.data.map((r: { changeReason: string }) => r.changeReason)).toEqual(['POLICY', 'TRANSFER', 'JOINING']);
    expect(json.reporting.length).toBe(2);
  });
});
