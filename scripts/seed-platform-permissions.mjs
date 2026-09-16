/**
 * Seeds the shared-platform permission codes (BRD 06, brief rule 3) and
 * grants them:
 *   company-admin, hr-admin → all ten
 *   hr-viewer               → workflow.view/act, notification.view, document.view/upload
 * Idempotent: upserts Permission rows by code and RolePermission rows by
 * (roleId, permissionId). Applies to every company's roles with those codes.
 *
 *   node scripts/seed-platform-permissions.mjs
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

// code = platform.<submodule>.<action>; hasPermission() splits the same way.
const PLATFORM_PERMISSIONS = [
  { code: "platform.workflow.view", submodule: "workflow", action: "view", description: "View workflow requests, inbox, matrices and request types" },
  { code: "platform.workflow.act", submodule: "workflow", action: "act", description: "Raise, submit, approve, reject, return, cancel workflow requests; create delegations" },
  { code: "platform.workflow.admin", submodule: "workflow", action: "admin", description: "HR Workflow Administrator: configure request types and matrices, cancel any request, run escalation, act on behalf" },
  { code: "platform.notification.view", submodule: "notification", action: "view", description: "View own notifications and delivery status" },
  { code: "platform.notification.admin", submodule: "notification", action: "admin", description: "Configure notification events, templates and routing; run dispatch" },
  { code: "platform.document.view", submodule: "document", action: "view", description: "View documents, document types and configuration snapshots" },
  { code: "platform.document.upload", submodule: "document", action: "upload", description: "Upload documents" },
  { code: "platform.document.verify", submodule: "document", action: "verify", description: "Verify or reject uploaded documents" },
  { code: "platform.document.admin", submodule: "document", action: "admin", description: "Configure document types; legal hold; expiry sweep" },
  { code: "platform.audit.view", submodule: "audit", action: "view", description: "Read the audit trail" },
].map((p) => ({ ...p, module: "platform", page: null }));

const HR_VIEWER_CODES = new Set([
  "platform.workflow.view",
  "platform.workflow.act",
  "platform.notification.view",
  "platform.document.view",
  "platform.document.upload",
]);

try {
  const permissionIdByCode = {};
  for (const perm of PLATFORM_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { module: perm.module, submodule: perm.submodule, page: perm.page, action: perm.action, description: perm.description, isActive: true, deletedAt: null },
      create: perm,
    });
    permissionIdByCode[perm.code] = row.id;
  }
  console.log(`Upserted ${PLATFORM_PERMISSIONS.length} platform permission codes.`);

  const roles = await prisma.role.findMany({ where: { code: { in: ["company-admin", "hr-admin", "hr-viewer"] }, deletedAt: null } });
  let grantCount = 0;
  for (const role of roles) {
    const codes = role.code === "hr-viewer" ? [...HR_VIEWER_CODES] : PLATFORM_PERMISSIONS.map((p) => p.code);
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIdByCode[code] } },
        update: {},
        create: { roleId: role.id, permissionId: permissionIdByCode[code] },
      });
      grantCount++;
    }
    console.log(`  ${role.code} (company ${role.companyId}, role ${role.id}): ${codes.length} grants`);
  }
  console.log(`Granted across ${roles.length} roles (${grantCount} grants upserted).`);
} finally {
  await prisma.$disconnect();
}
