/**
 * Demo handoff dump — all app users, their roles, and the effective RBAC matrix.
 *
 * Reads:
 *   - TOOLS_APP_USER            (Prisma model: User)
 *   - TOOLS_ROLE_PERMISSION     (Prisma model: RolePermission)
 *
 * Writes: scratch/demo-credentials.md  +  scratch/demo-credentials.html
 *
 * Run (read-only, safe):
 *   npx tsx scripts/dump-rbac-demo.ts
 *
 * Run with password reset (sets a known password on every NON-admin active user
 * so testers can actually log in — admin is never touched):
 *   npx tsx scripts/dump-rbac-demo.ts --reset-passwords
 *   npx tsx scripts/dump-rbac-demo.ts --reset-passwords --password="Demo@2026"
 *
 * NOTE: passwords are stored as bcrypt hashes and cannot be read back.
 * The only way to have a known password for a user is to set one.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "../src/lib/password";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_LABELS,
  CANONICAL_ROLES,
  rolePermissions,
} from "../src/lib/rolePermissions";

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const DO_RESET = argv.includes("--reset-passwords");
const RESET_PASSWORD =
  argv.find((a) => a.startsWith("--password="))?.split("=").slice(1).join("=") ??
  "Demo@2026";

/** Passwords we know from the seed scripts (only valid if seed was run and not since changed). */
const SEEDED_PASSWORDS: Record<string, string> = {
  demo1: "DemoUser1!",
  demo2: "DemoUser2!",
  demo3: "DemoUser3!",
};

const YES = "✓";
const NO = "·";

async function main() {
  // ── 1. Users ────────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      erpUserCode: true,
      isActive: true,
      createdAt: true,
    },
  });

  // ── 2. Optional password reset ──────────────────────────────────────────
  const knownPassword = new Map<string, string>();
  for (const [u, p] of Object.entries(SEEDED_PASSWORDS)) knownPassword.set(u, p);

  if (DO_RESET) {
    const hash = await hashPassword(RESET_PASSWORD);
    const targets = users.filter(
      (u) => u.isActive && u.username.toLowerCase() !== "admin"
    );
    for (const u of targets) {
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash },
      });
      knownPassword.set(u.username, RESET_PASSWORD);
    }
    console.log(
      `Reset password to "${RESET_PASSWORD}" for ${targets.length} active non-admin user(s).\n`
    );
  }

  // ── 3. Permission matrix from the DB ────────────────────────────────────
  const rows = await prisma.rolePermission.findMany({
    orderBy: [{ role: "asc" }, { permissionKey: "asc" }],
    select: { role: true, permissionKey: true, allowed: true },
  });

  const dbMatrix = new Map<string, Map<string, boolean>>();
  for (const r of rows) {
    if (!dbMatrix.has(r.role)) dbMatrix.set(r.role, new Map());
    dbMatrix.get(r.role)!.set(r.permissionKey, r.allowed);
  }

  // Every role we care about: canonical + anything actually in use.
  const rolesInUse = new Set<string>([
    ...CANONICAL_ROLES,
    ...dbMatrix.keys(),
    ...users.map((u) => u.role),
  ]);

  const effective = (role: string, key: string): boolean => {
    const fromDb = dbMatrix.get(role)?.get(key);
    if (typeof fromDb === "boolean") return fromDb;
    return Boolean(rolePermissions[role]?.[key as keyof typeof rolePermissions["Viewer"]]);
  };

  const source = (role: string): string => {
    if (dbMatrix.has(role)) return "DB";
    if (rolePermissions[role]) return "code fallback";
    return "NONE → denies all";
  };

  // ── 4. Console output ───────────────────────────────────────────────────
  console.log("═══ USERS ═══");
  console.table(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      active: u.isActive ? "yes" : "NO",
      password: knownPassword.get(u.username) ?? "(bcrypt — unknown)",
    }))
  );

  console.log("\n═══ ROLE → PERMISSIONS ═══");
  for (const role of [...rolesInUse].sort()) {
    const granted = ALL_PERMISSION_KEYS.filter((k) => effective(role, k));
    console.log(
      `${role.padEnd(24)} [${source(role).padEnd(15)}] ${
        granted.length ? granted.join(", ") : "— no permissions —"
      }`
    );
  }

  // ── 5. Markdown sheet ───────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const md: string[] = [];
  md.push(`# Demo credentials & RBAC matrix`, ``, `Generated ${stamp}`, ``);

  md.push(`## Users (${users.length})`, ``);
  md.push(`| id | username | name | role | active | password |`);
  md.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const u of users) {
    md.push(
      `| ${u.id} | \`${u.username}\` | ${u.name} | ${u.role} | ${
        u.isActive ? "yes" : "**no**"
      } | ${
        knownPassword.has(u.username)
          ? "`" + knownPassword.get(u.username) + "`"
          : "_bcrypt — not recoverable_"
      } |`
    );
  }

  md.push(``, `## Role → permission matrix`, ``);
  const sortedRoles = [...rolesInUse].sort();
  md.push(`| Permission | ${sortedRoles.join(" | ")} |`);
  md.push(`| --- | ${sortedRoles.map(() => "---").join(" | ")} |`);
  for (const key of ALL_PERMISSION_KEYS) {
    md.push(
      `| ${PERMISSION_LABELS[key]} | ${sortedRoles
        .map((r) => (effective(r, key) ? YES : NO))
        .join(" | ")} |`
    );
  }
  md.push(``, `| Role | matrix source |`, `| --- | --- |`);
  for (const r of sortedRoles) md.push(`| ${r} | ${source(r)} |`);

  const gaps = sortedRoles.filter((r) => source(r) === "NONE → denies all");
  if (gaps.length) {
    md.push(
      ``,
      `> **Warning:** no permission rows for ${gaps
        .map((g) => `\`${g}\``)
        .join(", ")} — these roles fall through to deny-all at runtime.`
    );
  }

  // ── 6. HTML sheet ───────────────────────────────────────────────────────
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Demo credentials — Suki Tools Management</title>
<style>
:root{color-scheme:light dark}
body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;max-width:1100px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;text-transform:uppercase;letter-spacing:.05em;opacity:.7}
.meta{opacity:.6;font-size:12px;margin-bottom:8px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid color-mix(in srgb,currentColor 18%,transparent);padding:6px 10px;text-align:left}
th{background:color-mix(in srgb,currentColor 7%,transparent);font-weight:600}
code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:color-mix(in srgb,currentColor 10%,transparent);padding:1px 5px;border-radius:4px}
.y{color:#0a7d34;font-weight:700;text-align:center}.n{opacity:.3;text-align:center}
.warn{margin-top:20px;padding:10px 14px;border-left:3px solid #c47f00;background:color-mix(in srgb,#c47f00 12%,transparent);font-size:13px}
.off{opacity:.5}
</style></head><body>
<h1>Demo credentials &amp; RBAC matrix</h1>
<div class="meta">Suki Tools Management · generated ${esc(stamp)}</div>

<h2>Users (${users.length})</h2>
<table><tr><th>id</th><th>username</th><th>name</th><th>role</th><th>active</th><th>password</th></tr>
${users
  .map(
    (u) => `<tr class="${u.isActive ? "" : "off"}"><td>${u.id}</td><td><code>${esc(
      u.username
    )}</code></td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${
      u.isActive ? "yes" : "<b>no</b>"
    }</td><td>${
      knownPassword.has(u.username)
        ? `<code>${esc(knownPassword.get(u.username)!)}</code>`
        : `<span class="off">bcrypt — not recoverable</span>`
    }</td></tr>`
  )
  .join("\n")}
</table>

<h2>Role → permissions</h2>
<table><tr><th>Permission</th>${sortedRoles
    .map((r) => `<th>${esc(r)}</th>`)
    .join("")}</tr>
${ALL_PERMISSION_KEYS.map(
  (k) =>
    `<tr><td>${esc(PERMISSION_LABELS[k])}</td>${sortedRoles
      .map((r) =>
        effective(r, k) ? `<td class="y">${YES}</td>` : `<td class="n">${NO}</td>`
      )
      .join("")}</tr>`
).join("\n")}
<tr><th>matrix source</th>${sortedRoles
    .map((r) => `<td style="font-size:11px;opacity:.7">${esc(source(r))}</td>`)
    .join("")}</tr>
</table>
${
  gaps.length
    ? `<div class="warn"><b>Warning:</b> no permission rows for ${gaps
        .map((g) => `<code>${esc(g)}</code>`)
        .join(", ")} — these roles deny everything at runtime. Add them to <code>src/lib/rolePermissions.ts</code> and re-run <code>npm run db:seed:role-permissions</code>.</div>`
    : ""
}
</body></html>`;

  const outDir = path.join(process.cwd(), "scratch");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "demo-credentials.md"), md.join("\n") + "\n");
  writeFileSync(path.join(outDir, "demo-credentials.html"), html);

  console.log(`\nWrote scratch/demo-credentials.md`);
  console.log(`Wrote scratch/demo-credentials.html`);
  if (gaps.length) {
    console.log(
      `\n!! Roles with NO permission rows (deny-all at runtime): ${gaps.join(", ")}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
