/**
 * Backfills the 5 permission codes added for Gratuity (Tier 5b) —
 * employee.separation.view/edit, payroll.gratuity.view/edit/approve — into
 * the global Permission catalog, then grants them to every existing
 * company's company-admin/hr-admin (all 5) and hr-viewer (the 2 .view codes)
 * roles. New companies get these automatically via bootstrap-admin
 * (src/app/api/superadmin/companies/[id]/bootstrap-admin/route.ts); this
 * script is for backfilling companies that predate this tier — same pattern
 * as seed-bonus-component.mjs. Idempotent (upsert throughout), never touches
 * User/password.
 *
 *   node scripts/seed-gratuity-permissions.mjs
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
  { code: "employee.separation.view", module: "employee", submodule: "separation", page: null, action: "view", description: "View recorded employee separations (exit interviews)" },
  { code: "employee.separation.edit", module: "employee", submodule: "separation", page: null, action: "edit", description: "Record an employee separation (exit interview)" },
  { code: "payroll.gratuity.view", module: "payroll", submodule: "gratuity", page: null, action: "view", description: "View gratuity records" },
  { code: "payroll.gratuity.edit", module: "payroll", submodule: "gratuity", page: null, action: "edit", description: "Calculate/recalculate a gratuity record for a separated employee" },
  { code: "payroll.gratuity.approve", module: "payroll", submodule: "gratuity", page: null, action: "approve", description: "Approve/reject/hold/mark-paid a gratuity record" },
];

const VIEW_ONLY_CODES = new Set(["employee.separation.view", "payroll.gratuity.view"]);

try {
  const permissionIdByCode = {};
  for (const perm of NEW_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, submodule: perm.submodule, page: perm.page, action: perm.action, description: perm.description },
      create: perm,
    });
    permissionIdByCode[perm.code] = row.id;
  }
  console.log(`Upserted ${NEW_PERMISSIONS.length} permission codes into the catalog.`);

  const roles = await prisma.role.findMany({ where: { code: { in: ["company-admin", "hr-admin", "hr-viewer"] } } });
  let grantCount = 0;
  for (const role of roles) {
    const codes = role.code === "hr-viewer" ? [...VIEW_ONLY_CODES] : NEW_PERMISSIONS.map((p) => p.code);
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIdByCode[code] } },
        update: {},
        create: { roleId: role.id, permissionId: permissionIdByCode[code] },
      });
      grantCount++;
    }
  }
  console.log(`Granted across ${roles.length} existing company-admin/hr-admin/hr-viewer roles (${grantCount} grants upserted).`);
} finally {
  await prisma.$disconnect();
}
