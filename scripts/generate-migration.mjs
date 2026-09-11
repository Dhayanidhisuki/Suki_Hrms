/**
 * Generates a migration SQL file by diffing the live DATABASE_URL against
 * prisma/schema.prisma. Safe for SQL Server URLs that contain characters that
 * break shell interpolation (spawnSync passes the env var directly to the
 * child process).
 *
 *   node scripts/generate-migration.mjs <migration-folder-name>
 *
 * Writes prisma/migrations/<name>/migration.sql — review before applying.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2];
if (!name) {
  console.error("Usage: node scripts/generate-migration.mjs <migration-folder-name>");
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

for (const line of readFileSync(`${root}/.env`, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const out = spawnSync(
  process.execPath,
  [
    `${root}/node_modules/prisma/build/index.js`,
    "migrate",
    "diff",
    "--from-url",
    process.env.DATABASE_URL,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" }, encoding: "utf8" }
);

if (out.status !== 0) {
  console.error("status:", out.status);
  console.error("error:", out.error);
  console.error("stdout:", out.stdout);
  console.error("stderr:", out.stderr);
  process.exit(1);
}

const dir = `${root}/prisma/migrations/${name}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/migration.sql`, out.stdout);
console.log(`Wrote ${dir}/migration.sql`);
