/**
 * Diagnose / repair the admin login without going through the API.
 *
 *   node scripts/reset-admin.mjs            → list users the login query can see
 *   node scripts/reset-admin.mjs --reset    → (re)create admin@suki.hrms / admin123
 *
 * Reads DATABASE_URL from .env itself, so no --env-file flag is needed.
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// --- minimal .env loader -----------------------------------------------------
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
} catch {
  console.warn("No .env found next to the project root — relying on the ambient environment.");
}

const EMAIL = "admin@suki.hrms";
const PASSWORD = "admin123";
const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isActive: true, deletedAt: true, roleId: true, passwordHash: true },
    orderBy: { id: "asc" },
  });

  console.log(`\nUser rows: ${users.length}`);
  for (const user of users) {
    console.log(
      `  #${user.id} ${user.email} | isActive=${user.isActive} | deletedAt=${user.deletedAt ?? "null"} | roleId=${user.roleId} | hash=${user.passwordHash.slice(0, 7)}… (${user.passwordHash.length} chars)`,
    );
  }

  const target = users.find((user) => user.email === EMAIL);
  if (target) {
    const matches = await bcrypt.compare(PASSWORD, target.passwordHash);
    console.log(`\n"${PASSWORD}" matches the stored hash for ${EMAIL}: ${matches}`);
    const visible = target.isActive && target.deletedAt === null;
    console.log(`Row is visible to the login query (isActive && !deletedAt): ${visible}`);
  } else {
    console.log(`\nNo row for ${EMAIL}.`);
  }

  if (process.argv.includes("--reset")) {
    const role = await prisma.role.upsert({
      where: { code: "admin" },
      update: {},
      create: { code: "admin", name: "Administrator", description: "Full access admin role" },
    });
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash, roleId: role.id, isActive: true, deletedAt: null },
      create: { email: EMAIL, passwordHash, roleId: role.id, isActive: true },
      select: { id: true, email: true },
    });
    console.log(`\nRepaired user #${user.id} ${user.email} — sign in with ${EMAIL} / ${PASSWORD}`);
  } else {
    console.log("\nRun again with --reset to (re)create that user.");
  }
} catch (error) {
  console.error("\nFailed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
