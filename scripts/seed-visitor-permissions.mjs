/**
 * Backfills visitor module permissions for existing roles.
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
  { code: "visitor.gate.view", module: "visitor", submodule: "gate", page: null, action: "view", description: "View visitor gate inward/outward/pass lists" },
  { code: "visitor.gate.create", module: "visitor", submodule: "gate", page: null, action: "create", description: "Create a visitor gate pass" },
  { code: "visitor.gate.edit", module: "visitor", submodule: "gate", page: null, action: "edit", description: "Edit an existing gate pass" },
  { code: "visitor.gate.cancel", module: "visitor", submodule: "gate", page: null, action: "cancel", description: "Cancel a gate pass" },
  { code: "visitor.gate.checkin", module: "visitor", submodule: "gate", page: null, action: "checkin", description: "Check in a visitor" },
  { code: "visitor.gate.checkout", module: "visitor", submodule: "gate", page: null, action: "checkout", description: "Check out a visitor" },
  { code: "visitor.gate.export", module: "visitor", submodule: "gate", page: null, action: "export", description: "Download visitor pass / gate pass PDF" },
  { code: "visitor.gate.approve", module: "visitor", submodule: "gate", page: null, action: "approve", description: "Approve a visitor request" },
  { code: "visitor.gate.reject", module: "visitor", submodule: "gate", page: null, action: "reject", description: "Reject a visitor request" },
];

const VIEW_ONLY_CODES = new Set(["visitor.gate.view"]);

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
  console.log(`Granted across ${roles.length} roles (${grantCount} grants upserted).`);
} finally {
  await prisma.$disconnect();
}
