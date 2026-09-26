import { readFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const userId = 276; // demoemployee@gmail.com
const companyId = 1;

// Copy org refs from EMP027's current JobInfo (real department/designation/type/shift)
const ref = await prisma.jobInfo.findFirst({
  where: { employee: { companyId, employeeCode: "EMP027" }, effectiveTo: null },
  select: { departmentId: true, designationId: true, employeeTypeId: true, unitId: true, shiftMasterId: true },
});
console.log("Org refs from EMP027:", JSON.stringify(ref));

const emp = await prisma.employee.create({
  data: {
    companyId,
    userId,
    employeeCode: "ADMIN-EMP",
    firstName: "Admin",
    lastName: "Employee",
    status: "active",
    isActive: true,
  },
});
console.log("Created employee:", emp.id, emp.employeeCode);

if (ref) {
  await prisma.jobInfo.create({
    data: {
      employeeId: emp.id,
      departmentId: ref.departmentId,
      designationId: ref.designationId,
      employeeTypeId: ref.employeeTypeId,
      unitId: ref.unitId,
      shiftMasterId: ref.shiftMasterId,
      joinDate: new Date("2026-09-01"),
      effectiveFrom: new Date("2026-09-01"),
      effectiveTo: null,
      esiApplicable: false,
      professionalTaxApplicable: false,
      pfApplicable: true,
      overtimeAllowed: false,
    },
  });
  console.log("Created JobInfo");
}
await prisma.$disconnect();
