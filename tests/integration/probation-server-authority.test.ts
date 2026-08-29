/**
 * probationEndDate must always be server-computed from joinDate +
 * probationPeriodMonths — the client's displayed value (or any value a
 * malicious client submits directly) is never trusted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTestEmployee, deleteTestEmployee, getAdminAuth, makeRequest } from './fixtures';

let auth: Awaited<ReturnType<typeof getAdminAuth>>;
let employeeId: number | null = null;

afterEach(async () => {
  if (employeeId) {
    await deleteTestEmployee(employeeId);
    employeeId = null;
  }
});

describe('probationEndDate — server-authoritative computation', () => {
  it('computes probationEndDate from joinDate + probationPeriodMonths on create, ignoring any client-submitted value', async () => {
    auth = await getAdminAuth();
    const created = await createTestEmployee(auth, {
      joinDate: '2026-01-01',
      probationPeriodMonths: 6,
      // A client should not be able to set this directly — it isn't even a
      // field on basicDetailsSchema, so this is just noise the server ignores.
      probationEndDate: '2099-12-31',
    });
    employeeId = created.id;

    const jobInfo = await prisma.jobInfo.findFirst({ where: { employeeId: created.id, effectiveTo: null } });
    expect(jobInfo!.probationEndDate?.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('recomputes probationEndDate on a Basic Details update when probationPeriodMonths changes', async () => {
    auth = await getAdminAuth();
    const created = await createTestEmployee(auth, { joinDate: '2026-01-01', probationPeriodMonths: 3 });
    employeeId = created.id;

    const before = await prisma.jobInfo.findFirst({ where: { employeeId: created.id, effectiveTo: null } });
    expect(before!.probationEndDate?.toISOString().slice(0, 10)).toBe('2026-04-01');

    const { PUT } = await import('@/app/api/employees/[id]/basic/route');
    const res = await PUT(
      makeRequest(`http://localhost/api/employees/${created.id}/basic`, {
        method: 'PUT',
        auth,
        body: {
          companyId: (await prisma.employee.findUnique({ where: { id: created.id } }))!.companyId,
          firstName: 'Automated',
          lastName: 'Test',
          employeeCode: created.employeeCode,
          departmentId: before!.departmentId,
          designationId: before!.designationId,
          employeeTypeId: before!.employeeTypeId,
          joinDate: '2026-01-01',
          probationPeriodMonths: 9,
        },
      }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(200);

    const after = await prisma.jobInfo.findFirst({ where: { employeeId: created.id, effectiveTo: null } });
    expect(after!.probationEndDate?.toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});
