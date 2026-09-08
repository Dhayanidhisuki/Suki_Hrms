/**
 * Upserts the two new payroll.pms.* Permission rows and grants them to
 * every existing role that already holds payroll.gratuity.* — same
 * payroll-approver set as the other payroll modules.
 *
 *   node scripts/grant-pms-permissions.mjs
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const NEW_PERMISSIONS = [
  { code: "payroll.pms.view", module: "payroll", submodule: "pms", page: null, action: "view", description: "View PMS incentive submissions" },
  { code: "payroll.pms.approve", module: "payroll", submodule: "pms", page: null, action: "approve", description: "Approve/reject a PMS incentive submission before payroll" },
];

try {
  const permissions = [];
  for (const p of NEW_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, submodule: p.submodule, page: p.page, action: p.action, description: p.description, isActive: true },
      create: p,
    });
    permissions.push(perm);
    console.log(`Permission "${p.code}" -> id ${perm.id}`);
  }

  const gratuityViewPerm = await prisma.permission.findUnique({ where: { code: "payroll.gratuity.view" } });
  const gratuityApprovePerm = await prisma.permission.findUnique({ where: { code: "payroll.gratuity.approve" } });

  const rolesWithView = gratuityViewPerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: gratuityViewPerm.id }, select: { roleId: true } })
    : [];
  const rolesWithApprove = gratuityApprovePerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: gratuityApprovePerm.id }, select: { roleId: true } })
    : [];

  const viewPerm = permissions.find((p) => p.code === "payroll.pms.view");
  const approvePerm = permissions.find((p) => p.code === "payroll.pms.approve");

  let grants = 0;
  for (const { roleId } of rolesWithView) {
    const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: viewPerm.id } });
    if (!exists) {
      await prisma.rolePermission.create({ data: { roleId, permissionId: viewPerm.id } });
      grants++;
    }
  }
  for (const { roleId } of rolesWithApprove) {
    const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: approvePerm.id } });
    if (!exists) {
      await prisma.rolePermission.create({ data: { roleId, permissionId: approvePerm.id } });
      grants++;
    }
  }

  console.log(`Granted ${grants} new role-permission rows.`);
} finally {
  await prisma.$disconnect();
}
