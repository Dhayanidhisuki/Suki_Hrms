/**
 * BRD 01 §20 — data scope applied in GET /api/employees and GET /api/employees/[id].
 *   • DEPARTMENT scope lists only that department
 *   • REPORTING_TREE DIRECT sees direct reports + self
 *   • no scope → self only (or nothing when the user has no employee record)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { testTenant, req, ctx, createEmployee, purgeEmployee, resetCodePolicy, createUser, purgeUser, baseMasters, type TestAuth } from './employee-helpers';

let admin: TestAuth;
let companyId: number;
let hrRoleId: number;
const employees: number[] = [];
const users: number[] = [];
let manager: number;
let e1: number;
let e2: number;
let e3: number;
let dept1Code: string;

beforeAll(async () => {
  const t = await testTenant();
  admin = t.adminAuth;
  companyId = t.companyId;
  hrRoleId = t.hrRoleId;
  const m = await baseMasters();
  dept1Code = m.department.code;

  manager = (await createEmployee(admin, { firstName: 'Scope', lastName: 'Manager', departmentId: m.department2.id })).id;
  e1 = (await createEmployee(admin, { firstName: 'Dept1', lastName: 'ReportsToM', departmentId: m.department.id, reportingManagerId: manager })).id;
  e2 = (await createEmployee(admin, { firstName: 'Dept2', lastName: 'ReportsToM', departmentId: m.department2.id, reportingManagerId: manager })).id;
  e3 = (await createEmployee(admin, { firstName: 'Dept1', lastName: 'Orphan', departmentId: m.department.id })).id;
  employees.push(manager, e1, e2, e3);
});

afterAll(async () => {
  for (const u of users) await purgeUser(u);
  for (const id of employees.reverse()) await purgeEmployee(id);
  await resetCodePolicy(companyId);
});

async function listIds(auth: TestAuth): Promise<number[]> {
  const { GET } = await import('@/app/api/employees/route');
  const res = await GET(req('http://localhost/api/employees?limit=100', { auth }));
  expect(res.status).toBe(200);
  const json = await res.json();
  return (json.data as Array<{ id: number }>).map((e) => e.id).filter((id) => employees.includes(id)).sort((a, b) => a - b);
}

async function getOne(auth: TestAuth, id: number): Promise<number> {
  const { GET } = await import('@/app/api/employees/[id]/route');
  const res = await GET(req(`http://localhost/api/employees/${id}`, { auth }), ctx(id));
  return res.status;
}

describe('data scope (§20)', () => {
  it('the company admin (COMPANY scope) still sees every employee', async () => {
    expect(await prisma.userScope.count({ where: { userId: admin.userId, companyId, scopeType: 'COMPANY', isActive: true } })).toBe(1);
    expect(await listIds(admin)).toEqual([...employees].sort((a, b) => a - b));
  });

  it('a user with a DEPARTMENT scope lists only that department and gets 404 outside it', async () => {
    const user = await createUser(companyId, hrRoleId, 'dept');
    users.push(user.id);
    await prisma.userScope.create({ data: { companyId, userId: user.id, scopeType: 'DEPARTMENT', scopeValues: dept1Code } });
    const auth: TestAuth = { userId: user.id, roleId: hrRoleId, companyId, roleCode: 'hr-admin' };

    expect(await listIds(auth)).toEqual([e1, e3].sort((a, b) => a - b));
    expect(await getOne(auth, e1)).toBe(200);
    expect(await getOne(auth, e2)).toBe(404);
  });

  it('a manager with REPORTING_TREE DIRECT sees direct reports + self', async () => {
    const user = await createUser(companyId, hrRoleId, 'mgr');
    users.push(user.id);
    await prisma.employee.update({ where: { id: manager }, data: { userId: user.id } });
    await prisma.userScope.create({ data: { companyId, userId: user.id, scopeType: 'REPORTING_TREE', treeDepth: 'DIRECT' } });
    const auth: TestAuth = { userId: user.id, roleId: hrRoleId, companyId, roleCode: 'hr-admin' };

    expect(await listIds(auth)).toEqual([manager, e1, e2].sort((a, b) => a - b));
    expect(await getOne(auth, e3)).toBe(404);
  });

  it('no scope → self only; no linked employee → nothing', async () => {
    const linked = await createUser(companyId, hrRoleId, 'self');
    users.push(linked.id);
    await prisma.employee.update({ where: { id: e3 }, data: { userId: linked.id } });
    expect(await listIds({ userId: linked.id, roleId: hrRoleId, companyId, roleCode: 'hr-admin' })).toEqual([e3]);

    const unlinked = await createUser(companyId, hrRoleId, 'none');
    users.push(unlinked.id);
    expect(await listIds({ userId: unlinked.id, roleId: hrRoleId, companyId, roleCode: 'hr-admin' })).toEqual([]);
    expect(await getOne({ userId: unlinked.id, roleId: hrRoleId, companyId, roleCode: 'hr-admin' }, e1)).toBe(404);
  });

  it('superadmin bypasses scope', async () => {
    const auth: TestAuth = { userId: 999999, roleId: hrRoleId, companyId, roleCode: 'hr-admin', isSuperAdmin: true };
    expect(await listIds(auth)).toEqual([...employees].sort((a, b) => a - b));
  });

  it('user-scope admin routes create and revoke assignments', async () => {
    const user = await createUser(companyId, hrRoleId, 'api');
    users.push(user.id);
    const { POST, GET } = await import('@/app/api/admin/user-scopes/route');
    const { DELETE } = await import('@/app/api/admin/user-scopes/[id]/route');

    const bad = await POST(req('http://localhost/api/admin/user-scopes', { method: 'POST', auth: admin, body: { userId: user.id, scopeType: 'DEPARTMENT' } }));
    expect(bad.status).toBe(400);

    const ok = await POST(req('http://localhost/api/admin/user-scopes', { method: 'POST', auth: admin, body: { userId: user.id, scopeType: 'DEPARTMENT', scopeValues: [dept1Code] } }));
    expect(ok.status).toBe(201);
    const row = await ok.json();

    const list = await GET(req(`http://localhost/api/admin/user-scopes?userId=${user.id}`, { auth: admin }));
    const listJson = await list.json();
    expect(listJson.data.map((r: { id: number }) => r.id)).toContain(row.id);
    expect(listJson.data[0].scopeValues).toEqual([dept1Code]);

    const del = await DELETE(req(`http://localhost/api/admin/user-scopes/${row.id}`, { method: 'DELETE', auth: admin }), ctx(row.id));
    expect(del.status).toBe(200);
    expect(await prisma.userScope.findUnique({ where: { id: row.id }, select: { isActive: true } })).toEqual({ isActive: false });
  });
});
