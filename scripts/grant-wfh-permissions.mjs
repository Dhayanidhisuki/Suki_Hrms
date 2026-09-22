/**
 * Upserts the two new workforce.wfh.* Permission rows and grants them to
 * every existing role that already holds workforce.on-duty.* — i.e.
 * whatever already does On-Duty approval work gets WFH too, without
 * re-running the full bootstrap-admin flow (which also resets the login
 * password — not appropriate for an already-provisioned company).
 *
 *   node scripts/grant-wfh-permissions.mjs
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
  { code: "workforce.wfh.view", module: "workforce", submodule: "wfh", page: null, action: "view", description: "View Work From Home (WFH) requests" },
  {
    code: "workforce.wfh.approve",
    module: "workforce",
    submodule: "wfh",
    page: null,
    action: "approve",
    description: "Give final HR approval/rejection on a WFH request (after Reporting Manager review)",
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

  const odViewPerm = await prisma.permission.findUnique({ where: { code: "workforce.on-duty.view" } });
  const odApprovePerm = await prisma.permission.findUnique({ where: { code: "workforce.on-duty.approve" } });

  const rolesWithOdView = odViewPerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: odViewPerm.id }, select: { roleId: true } })
    : [];
  const rolesWithOdApprove = odApprovePerm
    ? await prisma.rolePermission.findMany({ where: { permissionId: odApprovePerm.id }, select: { roleId: true } })
    : [];

  const viewPerm = permissions.find((p) => p.code === "workforce.wfh.view");
  const approvePerm = permissions.find((p) => p.code === "workforce.wfh.approve");

  let grants = 0;
  for (const { roleId } of rolesWithOdView) {
    const exists = await prisma.rolePermission.findFirst({ where: { roleId, permissionId: viewPerm.id } });
    if (!exists) {
      await prisma.rolePermission.create({ data: { roleId, permissionId: viewPerm.id } });
      grants++;
    }
  }
  for (const { roleId } of rolesWithOdApprove) {
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
