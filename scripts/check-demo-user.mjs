import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { email: { contains: "demoemployee" } },
  select: { id: true, email: true, companyId: true, isActive: true },
});
console.log("User:", JSON.stringify(user));

if (user) {
  const emp = await prisma.employee.findFirst({
    where: { userId: user.id },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, companyId: true, isActive: true, deletedAt: true },
  });
  console.log("Linked employee:", JSON.stringify(emp));
}

await prisma.$disconnect();
