/**
 * BRD 01 §20 — give every existing company-admin / hr-admin user a COMPANY
 * data scope so nothing that works today stops working once
 * GET /api/employees applies visibleEmployeeWhere. Idempotent: a user who
 * already holds an active COMPANY (or GLOBAL) scope is skipped.
 *
 *   node scripts/seed-user-scopes.mjs
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

const ADMIN_ROLE_CODES = ["company-admin", "hr-admin"];

const users = await prisma.user.findMany({
  where: { deletedAt: null, companyId: { not: null }, role: { code: { in: ADMIN_ROLE_CODES } } },
  select: { id: true, email: true, companyId: true, role: { select: { code: true } } },
});

let created = 0;
let skipped = 0;
for (const user of users) {
  const existing = await prisma.userScope.findFirst({
    where: { userId: user.id, companyId: user.companyId, isActive: true, scopeType: { in: ["COMPANY", "GLOBAL"] } },
    select: { id: true },
  });
  if (existing) {
    skipped++;
    continue;
  }
  await prisma.userScope.create({
    data: { companyId: user.companyId, userId: user.id, scopeType: "COMPANY", scopeValues: null, treeDepth: null, createdByUserId: null },
  });
  created++;
  console.log(`  + COMPANY scope for ${user.email} (${user.role.code}, company ${user.companyId})`);
}

console.log(`seed-user-scopes: ${users.length} admin users — ${created} scopes created, ${skipped} already present`);
console.log(`UserScope rows now: ${await prisma.userScope.count()}`);
await prisma.$disconnect();
