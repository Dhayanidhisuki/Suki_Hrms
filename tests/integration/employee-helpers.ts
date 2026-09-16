/**
 * Shared setup for the Employee Master (BRD 01) integration tests. Everything
 * runs in the TESTCO tenant (company code TESTCO, no real employees) so the
 * KUNAERO employee-code sequence is never consumed, and every row is deleted
 * again in afterAll. Requests mirror what proxy.ts injects — including
 * x-company-id and x-role-code, which the older fixtures.ts helper omits.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type TestAuth = { userId: number; roleId: number; companyId: number; roleCode: string; isSuperAdmin?: boolean };

export async function testTenant(): Promise<{ companyId: number; adminAuth: TestAuth; hrRoleId: number; viewerRoleId: number }> {
  // The tenant may be soft-deleted (it is a fixture company); roles and masters still resolve.
  const company = await prisma.company.findFirst({ where: { code: 'TESTCO' }, select: { id: true } });
  if (!company) throw new Error('TESTCO company missing — the integration tenant is not seeded');
  const roles = await prisma.role.findMany({ where: { companyId: company.id, code: { in: ['company-admin', 'hr-admin', 'hr-viewer'] } } });
  const byCode = new Map(roles.map((r) => [r.code, r.id]));
  const adminRole = byCode.get('company-admin');
  const hrRole = byCode.get('hr-admin');
  const viewerRole = byCode.get('hr-viewer');
  if (!adminRole || !hrRole || !viewerRole) throw new Error('TESTCO roles missing');
  const adminUser = await prisma.user.findFirst({ where: { companyId: company.id, roleId: adminRole }, select: { id: true } });
  if (!adminUser) throw new Error('TESTCO company-admin user missing');
  // The fixture admin is soft-deleted, so scripts/seed-user-scopes.mjs skipped it — give it the
  // COMPANY scope every real admin holds (idempotent; §20).
  const hasCompanyScope = await prisma.userScope.findFirst({ where: { userId: adminUser.id, companyId: company.id, scopeType: 'COMPANY', isActive: true } });
  if (!hasCompanyScope) await prisma.userScope.create({ data: { companyId: company.id, userId: adminUser.id, scopeType: 'COMPANY' } });
  return {
    companyId: company.id,
    adminAuth: { userId: adminUser.id, roleId: adminRole, companyId: company.id, roleCode: 'company-admin' },
    hrRoleId: hrRole,
    viewerRoleId: viewerRole,
  };
}

export function req(url: string, opts: { method?: string; body?: unknown; auth: TestAuth }): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-user-id': String(opts.auth.userId),
    'x-role-id': String(opts.auth.roleId),
    'x-role-code': opts.auth.roleCode,
    'x-company-id': String(opts.auth.companyId),
    'x-is-superadmin': String(opts.auth.isSuperAdmin === true),
  });
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

export async function baseMasters() {
  const [department, department2, designation, employeeType] = await Promise.all([
    prisma.department.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } }),
    prisma.department.findFirst({ where: { deletedAt: null }, orderBy: { id: 'desc' } }),
    prisma.designation.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } }),
    prisma.employeeType.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } }),
  ]);
  if (!department || !department2 || !designation || !employeeType || department.id === department2.id) {
    throw new Error('Need at least two departments, one designation and one employee type');
  }
  return { department, department2, designation, employeeType };
}

/** Create an employee through the real POST /api/employees handler. */
export async function createEmployee(auth: TestAuth, overrides: Record<string, unknown> = {}): Promise<{ id: number; employeeCode: string; lifecycleState: string | null }> {
  const { POST } = await import('@/app/api/employees/route');
  const m = await baseMasters();
  const res = await POST(
    req('http://localhost/api/employees', {
      method: 'POST',
      auth,
      body: {
        companyId: auth.companyId,
        firstName: 'Tranche',
        lastName: 'Three',
        departmentId: m.department.id,
        designationId: m.designation.id,
        employeeTypeId: m.employeeType.id,
        joinDate: '2026-01-01',
        ...overrides,
      },
    })
  );
  const json = await res.json();
  if (res.status !== 201) throw new Error(`createEmployee failed: ${res.status} ${JSON.stringify(json)}`);
  return { id: json.id, employeeCode: json.employeeCode, lifecycleState: json.lifecycleState ?? null };
}

/** Hard-delete an employee created by these tests and every child row. */
export async function purgeEmployee(id: number | null | undefined): Promise<void> {
  if (!id) return;
  const emp = await prisma.employee.findUnique({ where: { id }, select: { companyId: true } });
  if (!emp) return;
  const testco = await prisma.company.findFirst({ where: { code: 'TESTCO' }, select: { id: true } });
  if (emp.companyId !== testco?.id) throw new Error(`Refusing to purge employee ${id}: not in the TESTCO tenant`);
  await prisma.employee.updateMany({ where: { reportingManagerId: id }, data: { reportingManagerId: null } });
  await prisma.employee.updateMany({ where: { secondReportingManagerId: id }, data: { secondReportingManagerId: null } });
  await prisma.employeeStateTransition.deleteMany({ where: { employeeId: id } });
  await prisma.employeeReportingHistory.deleteMany({ where: { employeeId: id } });
  await prisma.employeeActivity.deleteMany({ where: { employeeId: id } });
  await prisma.employeeKyc.deleteMany({ where: { employeeId: id } });
  await prisma.employeeContactDetails.deleteMany({ where: { employeeId: id } });
  await prisma.personalDetails.deleteMany({ where: { employeeId: id } });
  await prisma.jobInfo.deleteMany({ where: { employeeId: id } });
  await prisma.employee.delete({ where: { id } });
}

/** Drop the tenant's derived code policy so the next run re-derives from scratch. */
export async function resetCodePolicy(companyId: number): Promise<void> {
  await prisma.employeeCodePolicy.deleteMany({ where: { companyId } });
}

export async function createUser(companyId: number, roleId: number, tag: string): Promise<{ id: number; email: string }> {
  const email = `tranche3-${tag}-${Date.now().toString(36)}@testco.suki.hrms`;
  return prisma.user.create({ data: { email, passwordHash: 'x', companyId, roleId, isActive: true }, select: { id: true, email: true } });
}

export async function purgeUser(id: number | null | undefined): Promise<void> {
  if (!id) return;
  await prisma.userScope.deleteMany({ where: { userId: id } });
  await prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id } });
}
