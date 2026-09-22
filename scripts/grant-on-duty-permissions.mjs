/**
 * Upserts the two new workforce.on-duty.* Permission rows and grants them
 * to every existing role that already holds workforce.mispunch.* — i.e.
 * whatever already does attendance-adjacent approval work gets On-Duty too,
 * without re-running the full bootstrap-admin flow (which also resets the
 * login password — not appropriate for an already-provisioned company).
 *
 *   node scripts/grant-on-duty-permissions.mjs
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
  { code: "workforce.on-duty.view", module: "workforce", submodule: "on-duty", page: null, action: "view", description: "View On-Duty (OD) requests" },
  {
    code: "workforce.on-duty.approve",
    module: "workforce",
    submodule: "on-duty",
    page: null,
    action: "approve",
    description: "Give final HR approval/rejection on an On-Duty request (after Reporting Manager review)",
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

  const rolesWithMispunchView = mispunchViewPerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: mispunchViewPerm.id }, select: { roleId: true } })
    : [];
  const rolesWithMispunchApprove = mispunchApprovePerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: mispunchApprovePerm.id }, select: { roleId: true } })
    : [];

  const viewPerm = permissions.find((p) => p.code === "workforce.on-duty.view");
  const approvePerm = permissions.find((p) => p.code === "workforce.on-duty.approve");

  let grants = 0;
  for (const { roleId } of rolesWithMispunchView) {
    const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: viewPerm.id } });
    if (!exists) {
      await prisma.rolePermission.create({ data: { roleId, permissionId: viewPerm.id } });
      grants++;
    }
  }
  for (const { roleId } of rolesWithMispunchApprove) {
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
