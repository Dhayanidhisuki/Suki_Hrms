/**
 * Upserts the two new workforce.ot.* Permission rows (added to
 * bootstrap-admin/route.ts's WORKFORCE_PERMISSIONS) and grants them to
 * every existing role that already holds workforce.mispunch.* — same
 * approvers as the Mispunch workflow, without re-running the full
 * bootstrap-admin flow (which also resets the login password).
 *
 *   node scripts/grant-ot-permissions.mjs
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
  { code: "workforce.ot.view", module: "workforce", submodule: "ot", page: null, action: "view", description: "View overtime awaiting approval" },
  {
    code: "workforce.ot.approve",
    module: "workforce",
    submodule: "ot",
    page: null,
    action: "approve",
    description: "Give final HR approval/rejection on overtime, including settling weekly-off/holiday OT as Comp-Off (after Reporting Manager review)",
  },
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

  const mispunchViewPerm = await prisma.permission.findUnique({ where: { code: "workforce.mispunch.view" } });
  const mispunchApprovePerm = await prisma.permission.findUnique({ where: { code: "workforce.mispunch.approve" } });

  const rolesWithView = mispunchViewPerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: mispunchViewPerm.id }, select: { roleId: true } })
    : [];
  const rolesWithApprove = mispunchApprovePerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: mispunchApprovePerm.id }, select: { roleId: true } })
    : [];

  const viewPerm = permissions.find((p) => p.code === "workforce.ot.view");
  const approvePerm = permissions.find((p) => p.code === "workforce.ot.approve");

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
