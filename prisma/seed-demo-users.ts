/**
 * Seed 3 demo users into TOOLS_APP_USER only (Prisma model: User).
 *
 * - Does NOT touch ERP_USER / erp_user
 * - Does NOT modify the existing System Admin (username "admin")
 * - Idempotent via upsert on username
 *
 * Run: npx tsx prisma/seed-demo-users.ts
 *  or: npm run db:seed:demo-users
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

/** Same role string used by prisma/seed.ts for the System Admin. */
const DEMO_ROLE = "Tools Admin";

/**
 * Demo accounts for tester handoff.
 * Plaintext passwords are printed once at seed time; only bcrypt hashes are stored.
 */
const DEMO_USERS = [
  {
    username: "demo1",
    name: "Demo User One",
    password: "DemoUser1!",
  },
  {
    username: "demo2",
    name: "Demo User Two",
    password: "DemoUser2!",
  },
  {
    username: "demo3",
    name: "Demo User Three",
    password: "DemoUser3!",
  },
] as const;

async function main() {
  console.log("Target table: TOOLS_APP_USER (Prisma model: User)");
  console.log(`Role for all demos: "${DEMO_ROLE}"`);
  console.log("Hashing: bcryptjs, 12 rounds (src/lib/password.ts)\n");

  const results: Array<{
    username: string;
    password: string;
    role: string;
    id: number;
    action: "created" | "updated";
  }> = [];

  for (const demo of DEMO_USERS) {
    if (demo.username.toLowerCase() === "admin") {
      throw new Error("Refusing to seed username 'admin' — System Admin must not be modified.");
    }

    const existing = await prisma.user.findUnique({
      where: { username: demo.username },
      select: { id: true },
    });

    const passwordHash = await hashPassword(demo.password);

    const user = await prisma.user.upsert({
      where: { username: demo.username },
      // Re-hash password + refresh demo fields if re-run; never touches "admin"
      update: {
        passwordHash,
        name: demo.name,
        role: DEMO_ROLE,
        isActive: true,
        deletedAt: null,
        // leave erpUserCode unchanged / null — no ERP linkage
        erpUserCode: null,
      },
      create: {
        username: demo.username,
        passwordHash,
        name: demo.name,
        role: DEMO_ROLE,
        erpUserCode: null,
        isActive: true,
      },
    });

    results.push({
      username: user.username,
      password: demo.password,
      role: user.role,
      id: user.id,
      action: existing ? "updated" : "created",
    });
  }

  console.log("── Demo login credentials (plaintext — share with testers) ──");
  for (const r of results) {
    console.log(
      `  ${r.action.padEnd(7)}  id=${r.id}  username=${r.username}  password=${r.password}  role=${r.role}`
    );
  }
  console.log("────────────────────────────────────────────────────────────");
  console.log("Stored in DB: bcrypt passwordHash only. System Admin untouched.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
