/**
 * Executes a migration SQL file as a single Prisma transaction.
 * Safe for SQL Server BEGIN TRY/CATCH blocks that the statement splitter
 * in apply-migration.mjs would otherwise break.
 */

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: node scripts/apply-visitor-migration.mjs <migration-folder-name> [--apply]");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

for (const line of readFileSync(`${root}/.env`, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const sql = readFileSync(`${root}/prisma/migrations/${migrationName}/migration.sql`, "utf8");

if (!apply) {
  console.log(sql);
  console.log("\nDry run — pass --apply to execute.");
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(sql);
    },
    { timeout: 60000, maxWait: 20000 }
  );
  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
