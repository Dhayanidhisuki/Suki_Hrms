/**
 * Seeds the employee.* and masters.org (companies) permission codes and
 * grants them all to the "admin" role. Idempotent — safe to re-run.
 *
 *   node scripts/seed-employee-permissions.mjs
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

// { code, module, submodule, action }
const PERMISSIONS = [
  { code: "employee.view", module: "employee", submodule: null, action: "view" },
  { code: "employee.create", module: "employee", submodule: null, action: "create" },
  { code: "employee.edit", module: "employee", submodule: null, action: "edit" },
  { code: "employee.deactivate", module: "employee", submodule: null, action: "deactivate" },
  { code: "employee.export", module: "employee", submodule: null, action: "export" },
  { code: "employee.salary.view", module: "employee", submodule: "salary", action: "view" },
  { code: "employee.salary.edit", module: "employee", submodule: "salary", action: "edit" },
  { code: "employee.kyc.view", module: "employee", submodule: "kyc", action: "view" },
  { code: "employee.kyc.edit", module: "employee", submodule: "kyc", action: "edit" },
  { code: "employee.kyc.reveal", module: "employee", submodule: "kyc", action: "reveal" },
  { code: "employee.asset.allocate", module: "employee", submodule: "asset", action: "allocate" },
  { code: "employee.activity.view", module: "employee", submodule: "activity", action: "view" },
];

try {
  const role = await prisma.role.upsert({
    where: { code: "admin" },
    update: {},
    create: { code: "admin", name: "Administrator", description: "Full access admin role" },
  });

  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, submodule: p.submodule, action: p.action },
      create: { code: p.code, module: p.module, submodule: p.submodule, action: p.action },
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });

    console.log(`  ${p.code} -> role "${role.code}"`);
  }

  // masters.org.view/edit already exist from the masters module (used by
  // the new Companies master page) — make sure admin has them too.
  for (const action of ["view", "edit"]) {
    const code = `masters.org.${action}`;
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { module: "masters", submodule: "org", action },
      create: { code, module: "masters", submodule: "org", action },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    console.log(`  ${code} -> role "${role.code}"`);
  }

  console.log("\nDone.");
} finally {
  await prisma.$disconnect();
}
