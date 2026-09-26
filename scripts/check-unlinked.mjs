import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const unlinked = await prisma.employee.findMany({
  where: { companyId: 1, userId: null, deletedAt: null, isActive: true },
  select: { id: true, employeeCode: true, firstName: true, lastName: true },
  take: 15,
  orderBy: { employeeCode: "asc" },
});
console.log("Unlinked employees:", unlinked.length);
for (const e of unlinked) console.log("  ", e.id, e.employeeCode, e.firstName, e.lastName);

const linked = await prisma.employee.findMany({
  where: { companyId: 1, userId: { not: null }, deletedAt: null },
  select: { id: true, employeeCode: true, firstName: true, userId: true, user: { select: { email: true } } },
  take: 10,
});
console.log("\nLinked employees:");
for (const e of linked) console.log("  ", e.employeeCode, e.firstName, "->", e.user?.email);

await prisma.$disconnect();
