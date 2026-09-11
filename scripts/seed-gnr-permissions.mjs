/**
 * Backfills GNR (material gate) permissions for existing roles.
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

const GNR_PERMISSIONS = [
  { code: "visitor.gnr.view", module: "visitor", submodule: "gnr", page: null, action: "view", description: "View GNR / material gate records" },
  { code: "visitor.gnr.create", module: "visitor", submodule: "gnr", page: null, action: "create", description: "Create a GNR against a DC" },
  { code: "visitor.gnr.edit", module: "visitor", submodule: "gnr", page: null, action: "edit", description: "Edit a GNR" },
  { code: "visitor.gnr.delete", module: "visitor", submodule: "gnr", page: null, action: "delete", description: "Delete/cancel a GNR" },
  { code: "visitor.gnr.authorize", module: "visitor", submodule: "gnr", page: null, action: "authorize", description: "Authorize a material outward GNR" },
  { code: "visitor.gnr.inward", module: "visitor", submodule: "gnr", page: null, action: "inward", description: "Record material gate inward" },
  { code: "visitor.gnr.outward", module: "visitor", submodule: "gnr", page: null, action: "outward", description: "Record material gate outward" },
  { code: "visitor.gnr.export", module: "visitor", submodule: "gnr", page: null, action: "export", description: "Export GNR reports" },
];

const VIEW_ONLY_CODES = new Set(["visitor.gnr.view"]);

try {
  const permissionIdByCode = {};
  for (const perm of GNR_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, submodule: perm.submodule, page: perm.page, action: perm.action, description: perm.description },
      create: perm,
    });
    permissionIdByCode[perm.code] = row.id;
  }
  console.log(`Upserted ${GNR_PERMISSIONS.length} GNR permission codes.`);

  const roles = await prisma.role.findMany({ where: { code: { in: ["company-admin", "hr-admin", "hr-viewer"] } } });
  let grantCount = 0;
  for (const role of roles) {
    const codes = role.code === "hr-viewer" ? [...VIEW_ONLY_CODES] : GNR_PERMISSIONS.map((p) => p.code);
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIdByCode[code] } },
        update: {},
        create: { roleId: role.id, permissionId: permissionIdByCode[code] },
      });
      grantCount++;
    }
  }
  console.log(`Granted across ${roles.length} roles (${grantCount} grants upserted).`);
} finally {
  await prisma.$disconnect();
}
