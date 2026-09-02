/**
 * POST /api/auth/seed
 *
 * Canonical, single-source permission/role seed for the whole app. Seeds:
 * - 29 permissions across 4 modules:
 *     masters.{org,statutory,shift,dropdown,definition}.{view,edit}  (10)
 *     employee.{view,create,edit,deactivate,export}                  (5)
 *     employee.salary.{view,edit}                                    (2)
 *     employee.kyc.{view,edit,reveal}                                (3)
 *     employee.document.{view,edit}                                  (2)
 *     employee.asset.allocate                                        (1)
 *     employee.activity.view                                         (1)
 *     admin.users.{view,edit}                                        (2)
 *     admin.roles.{view,edit}                                        (2)
 *     admin.permissions.view                                         (1)
 * - 3 roles:
 *     system-admin  — every permission above
 *     hr-admin      — every masters.* and employee.* permission (no admin.*)
 *     hr-viewer     — the view-flavored masters.* and employee.* permissions only
 *
 * This endpoint supersedes both the old inline masters-only seed (formerly
 * this file, which seeded the "admin"/"viewer" test roles) and the standalone
 * scripts/seed-employee-permissions.mjs script (now deprecated — see that
 * file). Any pre-existing "admin"/"viewer" role rows are left untouched (not
 * granted to, not deleted) — only system-admin/hr-admin/hr-viewer are
 * upserted here.
 *
 * Safe to call multiple times — everything is upserted.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
];

const ADMIN_PERMISSIONS: PermDef[] = [
  { code: 'admin.users.view', module: 'admin', submodule: 'users', page: null, action: 'view', description: 'View user accounts' },
  { code: 'admin.users.edit', module: 'admin', submodule: 'users', page: null, action: 'edit', description: 'Create/edit/deactivate user accounts' },
  { code: 'admin.roles.view', module: 'admin', submodule: 'roles', page: null, action: 'view', description: 'View roles and their permission grants' },
  { code: 'admin.roles.edit', module: 'admin', submodule: 'roles', page: null, action: 'edit', description: 'Create/edit roles and change their permission grants' },
  { code: 'admin.permissions.view', module: 'admin', submodule: 'permissions', page: null, action: 'view', description: 'View the permission catalog' },
];

const ALL_PERMISSIONS: PermDef[] = [...MASTERS_PERMISSIONS, ...EMPLOYEE_PERMISSIONS, ...ADMIN_PERMISSIONS];

const HR_ADMIN_CODES = [...MASTERS_PERMISSIONS, ...EMPLOYEE_PERMISSIONS].map((p) => p.code);

const HR_VIEWER_CODES = [
  'masters.org.view',
  'masters.statutory.view',
  'masters.shift.view',
  'masters.dropdown.view',
  'masters.definition.view',
  'employee.view',
  'employee.salary.view',
  'employee.kyc.view',
  'employee.document.view',
  'employee.activity.view',
];

interface RoleDef {
  code: string;
  name: string;
  description: string;
  codes: string[];
}

const ROLES: RoleDef[] = [
  {
    code: 'system-admin',
    name: 'System Admin',
    description: 'Full access to every module, including user & role administration',
    codes: ALL_PERMISSIONS.map((p) => p.code),
  },
  {
    code: 'hr-admin',
    name: 'HR Admin',
    description: 'Full access to masters and employee data; no user/role administration',
    codes: HR_ADMIN_CODES,
  },
  {
    code: 'hr-viewer',
    name: 'HR Viewer',
    description: 'Read-only access to masters and employee data',
    codes: HR_VIEWER_CODES,
  },
];

export async function POST() {
  const results: { permissions: number; roles: number; assignments: number } = {
    permissions: 0,
    roles: 0,
    assignments: 0,
  };

  // 1. Upsert all permissions
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
    results.permissions++;
  }

  // 2. Upsert roles + grant their permission sets
  const roleIds: Record<string, number> = {};
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description },
      create: { code: roleDef.code, name: roleDef.name, description: roleDef.description },
    });
    roleIds[roleDef.code] = role.id;
    results.roles++;

    for (const code of roleDef.codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      results.assignments++;
    }
  }

  return NextResponse.json({
    message: 'Seed complete',
    ...results,
    roleIds,
  });
}
