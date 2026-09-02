/**
 * Shared setup for integration tests: builds a real authenticated NextRequest
 * (mirroring what proxy.ts injects from a verified session — x-user-id/x-role-id
 * headers, since Edge middleware isn't in the request path when a route handler
 * is called directly in tests) and creates/tears down one dedicated test
 * employee via the real POST /api/employees handler.
 *
 * Every test employee's code is prefixed TEST-AUTO- so cleanup can safety-check
 * it never touches real data, same convention used for manual cleanup all
 * session.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const TEST_CODE_PREFIX = 'TEST-AUTO-';

export async function getAdminAuth(): Promise<{ roleId: number; userId: number }> {
  const role = await prisma.role.findFirst({ where: { code: 'admin' } });
  if (!role) throw new Error('admin role not seeded — run scripts/seed-employee-permissions.mjs');
  const user = await prisma.user.findFirst({ where: { roleId: role.id } });
  return { roleId: role.id, userId: user?.id ?? 1 };
}

export function makeRequest(
  url: string,
  opts: { method?: string; body?: unknown; auth: { roleId: number; userId: number } }
): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-role-id': String(opts.auth.roleId),
    'x-user-id': String(opts.auth.userId),
  });
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function requiredMasterIds() {
  const [company, department, designation, employeeType] = await Promise.all([
    prisma.company.findFirst({ where: { deletedAt: null } }),
    prisma.department.findFirst({ where: { deletedAt: null } }),
    prisma.designation.findFirst({ where: { deletedAt: null } }),
    prisma.employeeType.findFirst({ where: { deletedAt: null } }),
  ]);
  if (!company || !department || !designation || !employeeType) {
    throw new Error('Missing base master data (company/department/designation/employeeType) — cannot build a test employee.');
  }
  return {
    companyId: company.id,
    departmentId: department.id,
    designationId: designation.id,
    employeeTypeId: employeeType.id,
  };
}

/**
 * Creates a real test employee via the actual POST /api/employees route
 * handler. employeeCode is now server-generated (EMP001-style) and can't be
 * set by the caller, so oldEmployeeCode carries the TEST-AUTO- marker
 * deleteTestEmployee's safety check relies on instead.
 */
export async function createTestEmployee(
  auth: { roleId: number; userId: number },
  overrides: Record<string, unknown> = {}
): Promise<{ id: number; employeeCode: string }> {
  const { POST } = await import('@/app/api/employees/route');
  const masters = await requiredMasterIds();
  // oldEmployeeCode is NVarChar(20) — base36-compress the uniqueness suffix to fit.
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const oldEmployeeCode = `${TEST_CODE_PREFIX}${suffix}`.slice(0, 20);

  const res = await POST(
    makeRequest('http://localhost/api/employees', {
      method: 'POST',
      auth,
      body: {
        ...masters,
        firstName: 'Automated',
        lastName: 'Test',
        oldEmployeeCode,
        joinDate: '2026-01-01',
        ...overrides,
      },
    })
  );

  if (res.status !== 201) {
    const body = await res.json();
    throw new Error(`Failed to create test employee: ${res.status} ${JSON.stringify(body)}`);
  }
  const created = await res.json();
  return { id: created.id, employeeCode: created.employeeCode };
}

/** Deletes a test employee and every child row, safety-checked on the TEST-AUTO- oldEmployeeCode marker. */
export async function deleteTestEmployee(id: number | undefined | null): Promise<void> {
  if (!id) return;
  const employee = await prisma.employee.findUnique({ where: { id }, select: { employeeCode: true, oldEmployeeCode: true } });
  if (!employee) return;
  if (!employee.oldEmployeeCode?.startsWith(TEST_CODE_PREFIX)) {
    throw new Error(
      `Refusing to delete employee ${id} — oldEmployeeCode "${employee.oldEmployeeCode}" (code "${employee.employeeCode}") is not a TEST-AUTO- fixture.`
    );
  }

  await prisma.employeeActivity.deleteMany({ where: { employeeId: id } });
  await prisma.employeeAssetAllocation.deleteMany({ where: { employeeId: id } });
  await prisma.employeeSalaryComponent.deleteMany({ where: { salaryRevision: { employeeId: id } } });
  await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId: id } });
  await prisma.employeeCtc.deleteMany({ where: { employeeId: id } });
  await prisma.employeeEmergencyContact.deleteMany({ where: { employeeId: id } });
  await prisma.employeeKyc.deleteMany({ where: { employeeId: id } });
  await prisma.employeeBankDetail.deleteMany({ where: { employeeId: id } });
  await prisma.employeePassport.deleteMany({ where: { employeeId: id } });
  await prisma.employeeDependent.deleteMany({ where: { employeeId: id } });
  await prisma.employeeExperience.deleteMany({ where: { employeeId: id } });
  await prisma.employeeEducation.deleteMany({ where: { employeeId: id } });
  await prisma.employeeSkill.deleteMany({ where: { employeeId: id } });
  await prisma.employeeContactDetails.deleteMany({ where: { employeeId: id } });
  await prisma.personalDetails.deleteMany({ where: { employeeId: id } });
  await prisma.jobInfo.deleteMany({ where: { employeeId: id } });
  await prisma.employee.delete({ where: { id } });
}
