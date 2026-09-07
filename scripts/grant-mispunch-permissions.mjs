/**
 * Upserts the two new workforce.mispunch.* Permission rows (added to
 * bootstrap-admin/route.ts's WORKFORCE_PERMISSIONS) and grants them to
 * every existing role that already holds workforce.leave.* — i.e. whatever
 * already does leave-adjacent approval work gets mispunch too, without
 * re-running the full bootstrap-admin flow (which also resets the login
 * password — not appropriate for an already-provisioned company).
 *
 *   node scripts/grant-mispunch-permissions.mjs
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
  { code: "workforce.mispunch.view", module: "workforce", submodule: "mispunch", page: null, action: "view", description: "View mispunch correction requests" },
  {
    code: "workforce.mispunch.approve",
    module: "workforce",
    submodule: "mispunch",
    page: null,
    action: "approve",
    description: "Give final HR approval/rejection on a mispunch correction request (after Reporting Manager review)",
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

  const leaveViewPerm = await prisma.permission.findUnique({ where: { code: "workforce.leave.view" } });
  const leaveApprovePerm = await prisma.permission.findUnique({ where: { code: "workforce.leave.approve" } });

  const rolesWithLeaveView = leaveViewPerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: leaveViewPerm.id }, select: { roleId: true } })
    : [];
  const rolesWithLeaveApprove = leaveApprovePerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: leaveApprovePerm.id }, select: { roleId: true } })
    : [];

  const viewPerm = permissions.find((p) => p.code === "workforce.mispunch.view");
  const approvePerm = permissions.find((p) => p.code === "workforce.mispunch.approve");

  let grants = 0;
  for (const { roleId } of rolesWithLeaveView) {
    const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: viewPerm.id } });
    if (!exists) {
      await prisma.rolePermission.create({ data: { roleId, permissionId: viewPerm.id } });
      grants++;
    }
  }
  for (const { roleId } of rolesWithLeaveApprove) {
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
