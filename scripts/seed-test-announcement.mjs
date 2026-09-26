import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// Find admin user for createdByUserId
const admin = await prisma.user.findFirst({ where: { companyId: 1 }, orderBy: { id: 'asc' } });
const a = await prisma.announcement.create({
  data: {
    companyId: 1,
    title: "Yahooo!",
    body: "Your payroll contract is ready. Please review the new salary structure announced by HR.",
    category: "GENERAL",
    priority: "NORMAL",
    status: "PUBLISHED",
    publishedAt: new Date(),
    createdByUserId: admin?.id ?? 1,
  },
});
console.log("Created announcement id", a.id, "-", a.title);
await prisma.$disconnect();
