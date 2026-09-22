import { loadRepoEnv } from '../load-env';

loadRepoEnv();

import bcrypt from 'bcryptjs';
import { prisma } from '../../../src/lib/prisma';

export const E2E_ADMIN_EMAIL = 'fnf-e2e-admin@testco.suki.hrms';
export const E2E_ESS_EMAIL = 'fnf-e2e-ess@testco.suki.hrms';
export const E2E_PASSWORD = 'FnfE2e!2026';

const PERMS = [
  { code: 'payroll.processing.manage', module: 'payroll', submodule: 'processing', action: 'manage' },
  { code: 'payroll.processing.view', module: 'payroll', submodule: 'processing', action: 'view' },
  { code: 'employee.view', module: 'employee', submodule: undefined, action: 'view' },
  { code: 'employee.edit', module: 'employee', submodule: undefined, action: 'edit' },
  { code: 'employee.separation.view', module: 'employee', submodule: 'separation', action: 'view' },
  { code: 'employee.separation.edit', module: 'employee', submodule: 'separation', action: 'edit' },
] as const;

export type FnE2eSeed = {
  companyId: number;
  employeeCode: string;
  employeeId: number;
  cancelEmployeeCode: string;
  cancelEmployeeId: number;
  adminEmail: string;
  essEmail: string;
  password: string;
};

async function grantPerms(roleId: number) {
  for (const p of PERMS) {
    const row =
      (await prisma.permission.findFirst({
        where: { code: p.code, isActive: true, deletedAt: null },
      })) ??
      (await prisma.permission.create({
        data: { code: p.code, module: p.module, submodule: p.submodule, action: p.action, description: p.code },
      }));
    const existing = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: row.id } });
    if (!existing) await prisma.rolePermission.create({ data: { roleId, permissionId: row.id } });
  }
}

async function ensureUser(opts: {
  email: string;
  companyId: number;
  roleId: number;
  passwordHash: string;
}) {
  const existing = await prisma.user.findFirst({ where: { email: opts.email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: opts.passwordHash,
        companyId: opts.companyId,
        roleId: opts.roleId,
        isActive: true,
        deletedAt: null,
        isSuperAdmin: false,
      },
    });
    return existing.id;
  }
  const created = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: opts.passwordHash,
      companyId: opts.companyId,
      roleId: opts.roleId,
      isActive: true,
    },
  });
  return created.id;
}

async function ensureCompanyScope(userId: number, companyId: number) {
  const has = await prisma.userScope.findFirst({
    where: { userId, companyId, scopeType: 'COMPANY', isActive: true },
  });
  if (!has) await prisma.userScope.create({ data: { companyId, userId, scopeType: 'COMPANY' } });
}

async function purgeEmployee(employeeId: number) {
  const settlements = await prisma.fnFSettlement.findMany({ where: { employeeId } });
  for (const s of settlements) {
    await prisma.fnFSettlementLine.deleteMany({ where: { settlementId: s.id } });
    await prisma.notificationInApp.deleteMany({ where: { recipientEmpId: employeeId } });
    await prisma.notificationDelivery.deleteMany({
      where: { sourceEntityType: 'FnFSettlement', sourceEntityId: s.id },
    });
    if (s.freezeSnapshotId) {
      await prisma.configSnapshot.deleteMany({ where: { id: s.freezeSnapshotId } });
    }
  }
  await prisma.fnFSettlement.deleteMany({ where: { employeeId } });
  const exits = await prisma.exitInterview.findMany({ where: { employeeId } });
  for (const ex of exits) {
    await prisma.exitClearanceCheck.deleteMany({ where: { exitInterviewId: ex.id } });
  }
  await prisma.exitInterview.deleteMany({ where: { employeeId } });
  await prisma.employeeActivity.deleteMany({ where: { employeeId } });
  const revisions = await prisma.employeeSalaryRevision.findMany({ where: { employeeId } });
  for (const r of revisions) {
    await prisma.employeeSalaryComponent.deleteMany({ where: { salaryRevisionId: r.id } });
  }
  await prisma.employeeSalaryRevision.deleteMany({ where: { employeeId } });
  await prisma.employee.updateMany({
    where: { id: employeeId },
    data: { userId: null, deletedAt: new Date(), isActive: false },
  });
}

async function createEmployee(companyId: number, code: string, firstName: string, lastName: string, userId?: number) {
  return prisma.employee.create({
    data: {
      companyId,
      employeeCode: code,
      firstName,
      lastName,
      status: 'active',
      isActive: true,
      userId: userId ?? null,
    },
  });
}

export async function seedFnfE2e(): Promise<FnE2eSeed> {
  const company = await prisma.company.findFirst({ where: { code: 'TESTCO' } });
  if (!company) throw new Error('TESTCO company missing — seed the integration tenant first');

  await prisma.company.update({
    where: { id: company.id },
    data: { isActive: true, deletedAt: null },
  });

  const adminRole = await prisma.role.findFirst({
    where: { companyId: company.id, code: 'company-admin' },
  });
  const viewerRole = await prisma.role.findFirst({
    where: { companyId: company.id, code: 'hr-viewer' },
  });
  if (!adminRole || !viewerRole) throw new Error('TESTCO roles missing');

  await grantPerms(adminRole.id);
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  const adminUserId = await ensureUser({
    email: E2E_ADMIN_EMAIL,
    companyId: company.id,
    roleId: adminRole.id,
    passwordHash,
  });
  const essUserId = await ensureUser({
    email: E2E_ESS_EMAIL,
    companyId: company.id,
    roleId: viewerRole.id,
    passwordHash,
  });
  await ensureCompanyScope(adminUserId, company.id);
  await ensureCompanyScope(essUserId, company.id);

  const leftovers = await prisma.employee.findMany({
    where: { companyId: company.id, OR: [{ employeeCode: { startsWith: 'PWE2E' } }, { employeeCode: { startsWith: 'PWC2E' } }] },
    select: { id: true },
  });
  for (const row of leftovers) await purgeEmployee(row.id);

  const stamp = Date.now().toString(36).slice(-8);
  const employeeCode = `PWE2E${stamp}`.slice(0, 20);
  const cancelEmployeeCode = `PWC2E${stamp}`.slice(0, 20);
  const employee = await createEmployee(company.id, employeeCode, 'Playwright', 'Fnf', essUserId);
  const cancelEmployee = await createEmployee(company.id, cancelEmployeeCode, 'Playwright', 'Cancel');
  const cancelExit = await prisma.exitInterview.create({
    data: {
      employeeId: cancelEmployee.id,
      exitDate: new Date(),
      exitType: 'resignation',
      approvedLastWorkingDay: new Date(),
      clearanceStatus: 'CLEARED',
    },
  });
  await prisma.exitClearanceCheck.createMany({
    data: (['MANAGER', 'IT', 'FINANCE', 'HR'] as const).map((checkCode) => ({
      exitInterviewId: cancelExit.id,
      checkCode,
      status: 'CLEARED',
    })),
  });

  await prisma.fullAndFinalConfig.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      includeBonusProportion: true,
      salaryDivisorMode: 'CALENDAR',
      approvalStages: 'HR_FINANCE',
      clearanceRequired: true,
    },
    update: {
      includeBonusProportion: true,
      salaryDivisorMode: 'CALENDAR',
      approvalStages: 'HR_FINANCE',
      clearanceRequired: true,
    },
  });

  return {
    companyId: company.id,
    employeeCode,
    employeeId: employee.id,
    cancelEmployeeCode,
    cancelEmployeeId: cancelEmployee.id,
    adminEmail: E2E_ADMIN_EMAIL,
    essEmail: E2E_ESS_EMAIL,
    password: E2E_PASSWORD,
  };
}

export async function cleanupFnfE2e(seed: FnE2eSeed) {
  await purgeEmployee(seed.employeeId);
  await purgeEmployee(seed.cancelEmployeeId);
}
