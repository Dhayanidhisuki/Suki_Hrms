/**
 * Admin login doctor — diagnose (and optionally fix) "Invalid username or password".
 *
 * The login route rejects for FOUR different reasons, all showing the same message:
 *   1. no row with that username
 *   2. row exists but isActive = false
 *   3. row exists but deletedAt is set
 *   4. bcrypt compare failed (wrong password)
 * ...plus a 5th: in-memory rate limit (20 fails / 15 min per ip+username) → HTTP 429,
 *    same message. That one clears itself; restarting the server clears it instantly.
 *
 * This script tells you which one it is.
 *
 *   npx tsx scripts/admin-login-doctor.ts
 *   npx tsx scripts/admin-login-doctor.ts --user=admin
 *
 * Test a password you think is right (no writes):
 *   npx tsx scripts/admin-login-doctor.ts --check="MyPassword123"
 *
 * Reset it + reactivate the account:
 *   npx tsx scripts/admin-login-doctor.ts --set="NewAdminPass123!"
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const val = (flag: string) =>
  argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);

const USERNAME = val("--user") ?? "admin";
const CHECK = val("--check");
const SET = val("--set");

async function main() {
  // Deliberately NOT filtered by isActive / deletedAt — that's the whole point.
  const user = await prisma.user.findFirst({
    where: { username: USERNAME },
  });

  console.log(`\n── Looking up username "${USERNAME}" in TOOLS_APP_USER ──`);

  if (!user) {
    console.log(`  ✗ NO ROW FOUND.`);
    const all = await prisma.user.findMany({
      select: { id: true, username: true, role: true, isActive: true, deletedAt: true },
      orderBy: { id: "asc" },
    });
    console.log(`\n  Usernames that DO exist (${all.length}):`);
    console.table(
      all.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        active: u.isActive,
        deleted: u.deletedAt ? u.deletedAt.toISOString().slice(0, 10) : "",
      }))
    );
    console.log(
      `\n  → Username is case/space sensitive in the DB lookup. Check for a trailing space.`
    );
    return;
  }

  const hash = user.passwordHash ?? "";
  const blockers: string[] = [];
  if (!user.isActive) blockers.push("isActive = false");
  if (user.deletedAt) blockers.push(`deletedAt = ${user.deletedAt.toISOString()}`);
  if (!hash) blockers.push("passwordHash is EMPTY");
  if (hash && !/^\$2[aby]\$/.test(hash))
    blockers.push(`passwordHash is not bcrypt (starts "${hash.slice(0, 6)}…")`);

  console.log(`  ✓ Row found.`);
  console.table([
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : "(null)",
      hashPrefix: hash ? hash.slice(0, 7) + "…" : "(empty)",
      hashLen: hash.length,
    },
  ]);

  if (blockers.length) {
    console.log(`\n  ✗ LOGIN BLOCKED regardless of password:`);
    for (const b of blockers) console.log(`      • ${b}`);
  } else {
    console.log(
      `\n  ✓ Account state is fine — the row is active, not deleted, hash looks like bcrypt.`
    );
    console.log(`      So the failure is the password itself, or the 429 rate limit.`);
  }

  // ── optional: test a candidate password ────────────────────────────────
  if (CHECK !== undefined) {
    const ok = await verifyPassword(CHECK, hash);
    console.log(
      `\n── Password check ──\n  "${"*".repeat(CHECK.length)}" (${CHECK.length} chars) → ${
        ok ? "✓ MATCHES the stored hash" : "✗ does NOT match"
      }`
    );
  }

  // ── optional: reset ────────────────────────────────────────────────────
  if (SET !== undefined) {
    if (SET.length < 8) {
      console.log(`\n  ✗ Refusing to set a password shorter than 8 characters.`);
      return;
    }
    const passwordHash = await hashPassword(SET);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isActive: true, deletedAt: null },
    });
    console.log(`\n── Reset done ──`);
    console.log(`  username : ${user.username}`);
    console.log(`  password : ${SET}`);
    console.log(`  role     : ${user.role}`);
    console.log(`  account reactivated (isActive=true, deletedAt=null)`);
    console.log(
      `\n  If you still get "Invalid username or password" immediately after this,`
    );
    console.log(
      `  it's the rate limiter — restart the server (or wait 15 min) and try once more.`
    );
  }

  if (CHECK === undefined && SET === undefined) {
    console.log(
      `\n  Next: --check="thePassword" to test one, or --set="NewPass123!" to reset it.`
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
