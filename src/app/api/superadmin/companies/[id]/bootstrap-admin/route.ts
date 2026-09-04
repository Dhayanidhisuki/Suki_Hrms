/**
 * POST /api/superadmin/companies/[id]/bootstrap-admin
 *
 * Superadmin-only. For one company: upserts its 3 starter roles
 * (company-admin, hr-admin, hr-viewer) against the global Permission
 * catalog, then creates (or repairs) that company's first login user,
 * assigned company-admin.
 *
 * Same permission catalog and role-grant shape previously seeded globally
 * by the old POST /api/auth/seed (now retired) — just upserted per-company
 * instead of once platform-wide, and the former top role "system-admin" is
 * renamed "company-admin" here since "system" implied platform-wide, which
 * is now superadmin's job, not this role's.
 *
 * Body: { password: string, role?: string } — superadmin sets the password
 * by hand (no plaintext value to show back once it's hashed), and picks
 * which of this company's starter roles to assign — 'company-admin' by
 * default. The role dropdown only offers "Admin" today; more starter roles
 * can be added to ROLES/its UI options later without an API change.
 *
 * - If the company's admin@<code>.suki.hrms-style login doesn't exist yet:
 *   creates it with the given password and role.
 * - If it already exists: repairs roleId/isActive/deletedAt AND resets the
 *   password to the given value — this is also how superadmin resets
 *   credentials for an existing login.
 *
 * Safe to call multiple times.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/rbac-superadmin';
import { DEFAULT_SALARY_COMPONENTS } from '@/lib/defaultSalaryComponents';
import bcrypt from 'bcryptjs';

const bodySchema = z.object({
  password: z.string().min(6).max(72),
  role: z.string().optional(),
});

interface PermDef {
  code: string;
  module: string;
  submodule: string | null;
  page: string | null;
  action: string;
  description: string;
}

const MASTERS_PERMISSIONS: PermDef[] = [
  { code: 'masters.org.view', module: 'masters', submodule: 'org', page: '*', action: 'view', description: 'View organizational master tables' },
  { code: 'masters.org.edit', module: 'masters', submodule: 'org', page: '*', action: 'edit', description: 'Create/edit/delete organizational master tables' },
  { code: 'masters.statutory.view', module: 'masters', submodule: 'statutory', page: '*', action: 'view', description: 'View statutory slab/rate tables' },
  { code: 'masters.statutory.edit', module: 'masters', submodule: 'statutory', page: '*', action: 'edit', description: 'Create/edit statutory slab/rate tables' },
  { code: 'masters.shift.view', module: 'masters', submodule: 'shift', page: '*', action: 'view', description: 'View shift/OT definition tables' },
  { code: 'masters.shift.edit', module: 'masters', submodule: 'shift', page: '*', action: 'edit', description: 'Create/edit shift/OT definition tables' },
  { code: 'masters.dropdown.view', module: 'masters', submodule: 'dropdown', page: '*', action: 'view', description: 'View dropdown master' },
  { code: 'masters.dropdown.edit', module: 'masters', submodule: 'dropdown', page: '*', action: 'edit', description: 'Create/edit dropdown master' },
  { code: 'masters.definition.view', module: 'masters', submodule: 'definition', page: '*', action: 'view', description: 'View leave/loan/asset definition tables' },
  { code: 'masters.definition.edit', module: 'masters', submodule: 'definition', page: '*', action: 'edit', description: 'Create/edit leave/loan/asset definition tables' },
];

const EMPLOYEE_PERMISSIONS: PermDef[] = [
  { code: 'employee.view', module: 'employee', submodule: null, page: null, action: 'view', description: 'View employee master records' },
  { code: 'employee.create', module: 'employee', submodule: null, page: null, action: 'create', description: 'Create employee master records' },
  { code: 'employee.edit', module: 'employee', submodule: null, page: null, action: 'edit', description: 'Edit employee master records' },
  { code: 'employee.deactivate', module: 'employee', submodule: null, page: null, action: 'deactivate', description: 'Deactivate/offboard employees' },
  { code: 'employee.export', module: 'employee', submodule: null, page: null, action: 'export', description: 'Export employee data' },
  { code: 'employee.salary.view', module: 'employee', submodule: 'salary', page: null, action: 'view', description: 'View employee salary structure' },
  { code: 'employee.salary.edit', module: 'employee', submodule: 'salary', page: null, action: 'edit', description: 'Edit employee salary structure' },
  { code: 'employee.kyc.view', module: 'employee', submodule: 'kyc', page: null, action: 'view', description: 'View employee KYC & statutory details (masked)' },
  { code: 'employee.kyc.edit', module: 'employee', submodule: 'kyc', page: null, action: 'edit', description: 'Edit employee KYC & statutory details' },
  { code: 'employee.kyc.reveal', module: 'employee', submodule: 'kyc', page: null, action: 'reveal', description: 'Reveal unmasked PAN/Aadhaar values' },
  { code: 'employee.document.view', module: 'employee', submodule: 'document', page: null, action: 'view', description: 'View employee document records' },
  { code: 'employee.document.edit', module: 'employee', submodule: 'document', page: null, action: 'edit', description: 'Add/remove employee document records' },
  { code: 'employee.asset.allocate', module: 'employee', submodule: 'asset', page: null, action: 'allocate', description: 'Allocate assets to employees' },
  { code: 'employee.activity.view', module: 'employee', submodule: 'activity', page: null, action: 'view', description: 'View employee activity log' },
  { code: 'employee.separation.view', module: 'employee', submodule: 'separation', page: null, action: 'view', description: 'View recorded employee separations (exit interviews)' },
  { code: 'employee.separation.edit', module: 'employee', submodule: 'separation', page: null, action: 'edit', description: 'Record an employee separation (exit interview)' },
];

const WORKFORCE_PERMISSIONS: PermDef[] = [
  { code: 'workforce.attendance.view', module: 'workforce', submodule: 'attendance', page: null, action: 'view', description: 'View daily/monthly attendance' },
  { code: 'workforce.attendance.edit', module: 'workforce', submodule: 'attendance', page: null, action: 'edit', description: 'Mark/correct attendance, finalize/freeze/reopen a month' },
  { code: 'workforce.leave.view', module: 'workforce', submodule: 'leave', page: null, action: 'view', description: 'View leave applications and balances' },
  { code: 'workforce.leave.edit', module: 'workforce', submodule: 'leave', page: null, action: 'edit', description: 'Apply for leave on behalf of an employee' },
  { code: 'workforce.leave.approve', module: 'workforce', submodule: 'leave', page: null, action: 'approve', description: 'Approve/reject/cancel leave applications' },
];

const PAYROLL_PERMISSIONS: PermDef[] = [
  { code: 'payroll.processing.view', module: 'payroll', submodule: 'processing', page: null, action: 'view', description: 'View payroll runs and payslips' },
  { code: 'payroll.processing.edit', module: 'payroll', submodule: 'processing', page: null, action: 'edit', description: 'Create/calculate payroll runs, add ad-hoc earning/deduction lines' },
  { code: 'payroll.processing.approve', module: 'payroll', submodule: 'processing', page: null, action: 'approve', description: 'Approve/lock a payroll run' },
  { code: 'payroll.revision.view', module: 'payroll', submodule: 'revision', page: null, action: 'view', description: 'View salary revision requests and arrears' },
  { code: 'payroll.revision.edit', module: 'payroll', submodule: 'revision', page: null, action: 'edit', description: 'Create/submit/cancel salary revision requests, recalculate arrears' },
  { code: 'payroll.revision.approve', module: 'payroll', submodule: 'revision', page: null, action: 'approve', description: 'Approve/reject/hold a salary revision, apply an arrear to payroll' },
  { code: 'payroll.bonus.view', module: 'payroll', submodule: 'bonus', page: null, action: 'view', description: 'View bonus records' },
  { code: 'payroll.bonus.edit', module: 'payroll', submodule: 'bonus', page: null, action: 'edit', description: 'Calculate bonus records for an accounting year' },
  { code: 'payroll.bonus.approve', module: 'payroll', submodule: 'bonus', page: null, action: 'approve', description: 'Approve/reject/hold a bonus record, apply it to payroll' },
  { code: 'payroll.gratuity.view', module: 'payroll', submodule: 'gratuity', page: null, action: 'view', description: 'View gratuity records' },
  { code: 'payroll.gratuity.edit', module: 'payroll', submodule: 'gratuity', page: null, action: 'edit', description: 'Calculate/recalculate a gratuity record for a separated employee' },
  { code: 'payroll.gratuity.approve', module: 'payroll', submodule: 'gratuity', page: null, action: 'approve', description: 'Approve/reject/hold/mark-paid a gratuity record' },
];

const ADMIN_PERMISSIONS: PermDef[] = [
  { code: 'admin.users.view', module: 'admin', submodule: 'users', page: null, action: 'view', description: 'View user accounts' },
  { code: 'admin.users.edit', module: 'admin', submodule: 'users', page: null, action: 'edit', description: 'Create/edit/deactivate user accounts' },
  { code: 'admin.roles.view', module: 'admin', submodule: 'roles', page: null, action: 'view', description: 'View roles and their permission grants' },
  { code: 'admin.roles.edit', module: 'admin', submodule: 'roles', page: null, action: 'edit', description: 'Create/edit roles and change their permission grants' },
  { code: 'admin.permissions.view', module: 'admin', submodule: 'permissions', page: null, action: 'view', description: 'View the permission catalog' },
];

const ALL_PERMISSIONS: PermDef[] = [...MASTERS_PERMISSIONS, ...EMPLOYEE_PERMISSIONS, ...WORKFORCE_PERMISSIONS, ...PAYROLL_PERMISSIONS, ...ADMIN_PERMISSIONS];

const HR_ADMIN_CODES = [...MASTERS_PERMISSIONS, ...EMPLOYEE_PERMISSIONS, ...WORKFORCE_PERMISSIONS, ...PAYROLL_PERMISSIONS].map((p) => p.code);

const HR_VIEWER_CODES = [
  'masters.org.view',
  'masters.statutory.view',
  'masters.shift.view',
  'masters.dropdown.view',
  'masters.definition.view',
  'employee.view',
  'employee.salary.view',
  'payroll.processing.view',
  'payroll.revision.view',
  'payroll.bonus.view',
  'payroll.gratuity.view',
  'employee.kyc.view',
  'employee.document.view',
  'employee.activity.view',
  'employee.separation.view',
  'workforce.attendance.view',
  'workforce.leave.view',
];

interface RoleDef {
  code: string;
  name: string;
  description: string;
  codes: string[];
}

const ROLES: RoleDef[] = [
  {
    code: 'company-admin',
    name: 'Company Admin',
    description: 'Full access within this company, including its user & role administration',
    codes: ALL_PERMISSIONS.map((p) => p.code),
  },
  {
    code: 'hr-admin',
    name: 'HR Admin',
    description: 'Full access to masters and employee data within this company; no user/role administration',
    codes: HR_ADMIN_CODES,
  },
  {
    code: 'hr-viewer',
    name: 'HR Viewer',
    description: 'Read-only access to masters and employee data within this company',
    codes: HR_VIEWER_CODES,
  },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await requireSuperAdmin(request);
  if (permErr) return permErr;
  const { id } = await params;
  const companyId = parseInt(id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const requestedRoleCode = parsed.data.role ?? 'company-admin';
  if (!ROLES.some((r) => r.code === requestedRoleCode)) {
    return NextResponse.json({ error: `Unknown role "${requestedRoleCode}"` }, { status: 400 });
  }

  const company = await prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  // 1. Upsert all permissions in the global catalog (shared across companies)
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        submodule: perm.submodule,
        page: perm.page,
        action: perm.action,
        description: perm.description,
      },
      create: {
        code: perm.code,
        module: perm.module,
        submodule: perm.submodule,
        page: perm.page,
        action: perm.action,
        description: perm.description,
      },
    });
  }

  // 2. Upsert this company's starter roles + grant their permission sets
  const roleIdByCode: Record<string, number> = {};
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { companyId_code: { companyId, code: roleDef.code } },
      update: { name: roleDef.name, description: roleDef.description },
      create: { companyId, code: roleDef.code, name: roleDef.name, description: roleDef.description },
    });
    roleIdByCode[roleDef.code] = role.id;

    for (const code of roleDef.codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const targetRoleId = roleIdByCode[requestedRoleCode];
  if (!targetRoleId) {
    return NextResponse.json({ error: `Failed to seed "${requestedRoleCode}" role` }, { status: 500 });
  }

  // 3. Seed this company's starter SalaryComponent catalog (Payroll/Arrear/
  // Bonus depend on the isSystemDefined codes existing by exact code — see
  // src/lib/defaultSalaryComponents.ts). Only creates missing rows
  // (`update: {}`) — re-running bootstrap-admin (e.g. to reset a login)
  // never overwrites a name/type a company admin already edited.
  for (const comp of DEFAULT_SALARY_COMPONENTS) {
    await prisma.salaryComponent.upsert({
      where: { companyId_code: { companyId, code: comp.code } },
      update: {},
      create: { companyId, code: comp.code, name: comp.name, type: comp.type, isSystemDefined: comp.isSystemDefined },
    });
  }

  // 4. Create (or reset) this company's login, with the password superadmin
  // typed in (never auto-generated) and the role they picked.
  const email = `admin@${company.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.suki.hrms`;
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { companyId, roleId: targetRoleId, isActive: true, deletedAt: null, passwordHash },
        select: { id: true, email: true, companyId: true, roleId: true },
      })
    : await prisma.user.create({
        data: { email, passwordHash, companyId, roleId: targetRoleId, isActive: true },
        select: { id: true, email: true, companyId: true, roleId: true },
      });

  return NextResponse.json({
    message: existingUser
      ? 'Company-admin login reset — role/company repaired, account reactivated, password updated.'
      : 'Company-admin login created.',
    user,
  });
}
