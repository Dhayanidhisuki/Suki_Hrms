/**
 * Upserts the payroll.dm.approve Permission row and grants it to every role
 * that already holds payroll.pms.approve — the same payroll-approver set as
 * the other incentive modules.
 *
 * Needed because Double Machine / Other Incentives rows are now PAID by
 * payroll when they reach `complete`, and only this permission can move a row
 * there. Without the grant, nobody can approve and nothing gets paid.
 *
 *   node scripts/grant-double-machine-permissions.mjs
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

const NEW_PERMISSION = {
  code: "payroll.dm.approve",
  module: "payroll",
  submodule: "dm",
  page: null,
  action: "approve",
  description: "Approve/hold/return a Double Machine & Other Incentives row — `complete` rows are paid by payroll",
};

try {
  const perm = await prisma.permission.upsert({
    where: { code: NEW_PERMISSION.code },
    update: { ...NEW_PERMISSION, isActive: true },
    create: NEW_PERMISSION,
  });
  console.log(`Permission "${perm.code}" -> id ${perm.id}`);

  const pmsApprove = await prisma.permission.findUnique({ where: { code: "payroll.pms.approve" } });
  if (!pmsApprove) {
    console.log("payroll.pms.approve not found — run scripts/grant-pms-permissions.mjs first, then re-run this.");
  } else {
    const roles = await prisma.rolePermission.findMany({
      where: { permissionId: pmsApprove.id },
      select: { roleId: true },
    });
    let grants = 0;
    for (const { roleId } of roles) {
      const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: perm.id } });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId, permissionId: perm.id } });
        grants++;
      }
    }
    console.log(`Granted ${grants} new role-permission rows across ${roles.length} approver role(s).`);
  }
} finally {
  await prisma.$disconnect();
}
