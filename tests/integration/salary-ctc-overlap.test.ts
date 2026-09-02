/**
 * Covers the exact bug found and fixed during manual testing this session:
 * backdating a new salary/CTC revision closed the "current" revision's
 * effectiveTo to a date BEFORE its own effectiveFrom, producing an inverted
 * range. Both routes now reject a revision that isn't after the current one.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee, getAdminAuth, makeRequest } from './fixtures';

let auth: Awaited<ReturnType<typeof getAdminAuth>>;
let employeeId: number;

beforeAll(async () => {
  auth = await getAdminAuth();
  ({ id: employeeId } = await createTestEmployee(auth));
});

afterAll(async () => {
  await deleteTestEmployee(employeeId);
});

describe('POST /api/employees/[id]/salary', () => {
  it('creates the first revision as current (effectiveTo null)', async () => {
    const { POST } = await import('@/app/api/employees/[id]/salary/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeId}/salary`, {
        method: 'POST',
        auth,
        body: { grossSalary: 50000, effectiveFrom: '2026-01-01', components: [] },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.effectiveTo).toBeNull();
  });

  it('rejects a backdated revision instead of corrupting the current one', async () => {
    const before = await prisma.employeeSalaryRevision.findFirst({ where: { employeeId, effectiveTo: null } });

    const { POST } = await import('@/app/api/employees/[id]/salary/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeId}/salary`, {
        method: 'POST',
        auth,
        body: { grossSalary: 40000, effectiveFrom: '2025-06-01', components: [] },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(res.status).toBe(409);

    // The previously-current revision must be untouched — this is the
    // regression check for the inverted-range bug.
    const after = await prisma.employeeSalaryRevision.findUnique({ where: { id: before!.id } });
    expect(after!.effectiveTo).toBeNull();
    expect(after!.effectiveFrom.getTime()).toBe(before!.effectiveFrom.getTime());
  });

  it('closes the previous revision when a forward-dated one is added, with no gap or inversion', async () => {
    const { POST } = await import('@/app/api/employees/[id]/salary/route');
    const res = await POST(
      makeRequest(`http://localhost/api/employees/${employeeId}/salary`, {
        method: 'POST',
        auth,
        body: { grossSalary: 60000, effectiveFrom: '2026-06-01', components: [] },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(res.status).toBe(201);

    const revisions = await prisma.employeeSalaryRevision.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'asc' },
    });
    expect(revisions).toHaveLength(2);
    expect(revisions[0].effectiveTo?.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(revisions[0].effectiveFrom.getTime()).toBeLessThan(revisions[0].effectiveTo!.getTime());
    expect(revisions[1].effectiveTo).toBeNull();
  });
});

describe('POST /api/employees/[id]/ctc', () => {
  it('rejects a backdated CTC revision the same way', async () => {
    const { POST: createFirst } = await import('@/app/api/employees/[id]/ctc/route');
    const first = await createFirst(
      makeRequest(`http://localhost/api/employees/${employeeId}/ctc`, {
        method: 'POST',
        auth,
        body: { basic: 30000, monthlyCtc: 45000, annualCtc: 540000, effectiveFrom: '2026-01-01' },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(first.status).toBe(201);

    const { POST: createBackdated } = await import('@/app/api/employees/[id]/ctc/route');
    const res = await createBackdated(
      makeRequest(`http://localhost/api/employees/${employeeId}/ctc`, {
        method: 'POST',
        auth,
        body: { basic: 25000, monthlyCtc: 40000, annualCtc: 480000, effectiveFrom: '2025-01-01' },
      }),
      { params: Promise.resolve({ id: String(employeeId) }) }
    );
    expect(res.status).toBe(409);
  });
});
