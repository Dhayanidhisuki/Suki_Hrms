/**
 * Seed TOOLS_ROLE_PERMISSION from the canonical matrix in
 * src/lib/rolePermissions.ts (exact match to prior hardcoded behavior).
 *
 * Idempotent: upserts each (role, permission_key) row.
 *
 * Run: npx tsx prisma/seed-role-permissions.ts
 *  or: npm run db:seed:role-permissions
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { rolePermissionSeedRows } from "../src/lib/rolePermissions";

const prisma = new PrismaClient();

async function main() {
  const rows = rolePermissionSeedRows();
  console.log(
    `Seeding TOOLS_ROLE_PERMISSION from rolePermissions.ts (${rows.length} rows)…`
  );

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.rolePermission.findUnique({
      where: {
        role_permissionKey: {
          role: row.role,
          permissionKey: row.permissionKey,
        },
      },
      select: { id: true, allowed: true },
    });

    await prisma.rolePermission.upsert({
      where: {
        role_permissionKey: {
          role: row.role,
          permissionKey: row.permissionKey,
        },
      },
      create: {
        role: row.role,
        permissionKey: row.permissionKey,
        allowed: row.allowed,
      },
      update: {
        allowed: row.allowed,
      },
    });

    if (!existing) created += 1;
    else if (existing.allowed !== row.allowed) updated += 1;
  }

  const roles = new Set(rows.map((r) => r.role));
  console.log(
    `Done. roles=${roles.size} created=${created} changed=${updated} unchanged=${rows.length - created - updated}`
  );
  console.log(`Roles: ${[...roles].join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
