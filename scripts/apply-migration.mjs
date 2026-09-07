/**
 * Applies a prisma/migrations/<name>/migration.sql file statement-by-statement
 * inside one Prisma interactive transaction. Generalized from
 * apply-migration-000001.mjs — see that file's header for why statements run
 * individually rather than as one `db execute --file` batch.
 *
 *   node scripts/apply-migration.mjs <migration-folder-name>            → dry run
 *   node scripts/apply-migration.mjs <migration-folder-name> --apply    → executes
 */

import { readFileSync } from "node:fs";

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: node scripts/apply-migration.mjs <migration-folder-name> [--apply]");
  process.exit(1);
}

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const sqlPath = new URL(`../prisma/migrations/${migrationName}/migration.sql`, import.meta.url);
const raw = readFileSync(sqlPath, "utf8");

const SKIP_LINE = /^\s*(--.*|GO|SET XACT_ABORT ON;|BEGIN TRAN;|COMMIT TRAN;)?\s*$/i;

const cleanedLines = raw.split("\n").filter((line) => !SKIP_LINE.test(line) || line.trim() === "");
const cleaned = cleanedLines.join("\n");

const statements = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
  .map((s) => s + ";");

console.log(`Parsed ${statements.length} statements.\n`);

const apply = process.argv.includes("--apply");

if (!apply) {
  statements.forEach((s, i) => console.log(`--- [${i + 1}/${statements.length}] ---\n${s}\n`));
  console.log("Dry run only — pass --apply to execute against the database.");
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        console.log(`[${i + 1}/${statements.length}] executing...`);
        await tx.$executeRawUnsafe(stmt);
      }
    },
    { timeout: 60000, maxWait: 20000 }
  );
  console.log("\nMigration applied successfully.");
} catch (err) {
  console.error("\nMigration FAILED — transaction rolled back automatically. Error:");
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
