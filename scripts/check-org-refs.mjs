import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const codes = await prisma.employee.findMany({
  where: { companyId: 1, employeeCode: { startsWith: "ADMIN" } },
  select: { employeeCode: true },
});
console.log("ADMIN* codes:", codes.map(c => c.employeeCode));

// Sample job info of a real employee to copy org refs from EMP027
const ji = await prisma.jobInfo.findFirst({
  where: { employee: { companyId: 1, employeeCode: "EMP027" }, effectiveTo: null },
});
console.log("EMP027 JobInfo:", JSON.stringify(ji, null, 2));

await prisma.$disconnect();
