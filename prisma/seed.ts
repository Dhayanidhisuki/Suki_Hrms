import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = (process.env.SEED_ADMIN_NAME ?? "System Admin").trim();
  /** Must exist in ERP_USER.USER_ID — used for CREAT_USER_ID_CD FKs on ERP tables */
  const erpUserCode = (process.env.SEED_ADMIN_ERP_USER_CODE ?? "GANESH").trim().slice(0, 10);

  if (!password || password.length < 8) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be set in the environment and be at least 8 characters."
    );
  }

  const erpUser = await prisma.erpUser.findUnique({ where: { userId: erpUserCode } });
  if (!erpUser) {
    throw new Error(
      `SEED_ADMIN_ERP_USER_CODE="${erpUserCode}" was not found in ERP_USER. Pick a real USER_ID.`
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      name,
      role: "Tools Admin",
      erpUserCode,
      isActive: true,
      deletedAt: null,
    },
    create: {
      username,
      passwordHash,
      name,
      role: "Tools Admin",
      erpUserCode,
      isActive: true,
    },
  });

  console.log(
    `Seed admin ready: id=${user.id} username=${user.username} role=${user.role} erpUserCode=${user.erpUserCode}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
