/**
 * Seeds Company, Department, Designation, EmployeeType, and Grade reference
 * data sourced from D:\CRM\kun hrms\Organization.rpt and
 * employee classificatin.rpt. Idempotent (upsert by unique code) — safe to
 * re-run. Does not delete or overwrite rows outside this known set.
 *
 *   node scripts/seed-company-and-org.mjs
 */

import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// From Organization.rpt — DEPT_NO / DEPT_NAME (32 rows)
const DEPARTMENTS = [
  [20, "SALES"], [30, "HR"], [40, "PRODUCTION"], [50, "ACCOUNTS"], [60, "QUALITY"],
  [70, "PLANNING"], [80, "PACKING"], [90, "PURCHASE"], [100, "DESPATCH"],
  [110, "EXPORTS & LOGISTICS"], [120, "DRIVER"], [130, "HOUSE KEEPING"],
  [140, "DEBURRING"], [150, "WELDING"], [160, "ADMINISTRATOR"], [170, "MPLD"],
  [180, "OPERATIONS"], [190, "STORE"], [210, "FINAL INSPECTION"], [220, "MAINTENANCE"],
  [230, "ENGINEERING & PROJECTS"], [240, "ADMINISTRATION"],
  [250, "MANAGEMENT REPRESENTATIVE"], [260, "PROJECTS - DMG"],
  [270, "EXECUTIVE DIRECTOR"], [280, "SUPPLY CHAIN"], [290, "HR & ADMIN"],
  [300, "IT & SYSTEM"], [310, "COSTING & ESTIMATIONS"], [320, "ENGINEERING"],
  [330, "WIP"], [340, "PPC"],
];

// From employee classificatin.rpt — DESIG_CODE / NAME (100 rows)
const DESIGNATIONS = [
  [100, "HR MANGAR"], [101, "QUALITY ENGINEER"], [102, "STORES INCHARGE"],
  [104, "QUALITY INSPECTOR"], [105, "PURCHASE INCHARGE"], [106, "SALES INCHARGE"],
  [107, "DESPATCH INCHARGE"], [108, "SENIOR QA ENGINEER"], [109, "STORES EXECUTIVE"],
  [110, "MR"], [111, "NPD ENGINEER"], [112, "TRAINEE - LINE INSPECTOR"],
  [113, "DIRECTOR"], [114, "MANAGER - ACCOUNTS"], [115, "GENERAL MANAGER"],
  [116, "OPERATOR"], [117, "HOUSE KEEPING"], [118, "PRODUCTION INCHARGE"],
  [119, "STORE INCHARGE"], [120, "QUALITY MANAGER"], [121, "PRODUCTION MANAGER"],
  [122, "STORE HELPER"], [123, "SHIFT INCHARGE"], [124, "QUALITY INCHARGE"],
  [125, "FINAL INSPECTOR"], [126, "PACKING"], [127, "INCOMING QUALITY"],
  [128, "DRIVER"], [129, "JUNIOR ACCOUNTANT"], [130, "MAINTENANCE"],
  [131, "HR MANAGER"], [132, "ASSISTANT MANAGER"], [133, "ENGINEER"],
  [134, "SR.ENGINEER"], [135, "MANAGER"], [136, "TRAINER"], [137, "TRAINEE"],
  [138, "SR.TECHNICIAN"], [139, "ASSISTANT ENGINEER"], [140, "JR.ENGINEER"],
  [141, "ASSISTANT"], [142, "CNC OPERATOR"], [143, "MANAGEMENT REPRESENTATIVE"],
  [144, "CUTTING MACHINE OPERATOR"], [145, "DMG MACHINE OPERATOR"],
  [146, "VMC OPERATOR"], [147, "EXECUTIVE DIRECTOR"], [148, "VICE PRESIDENT"],
  [149, "PROGRAMME MANAGER"], [150, "OFFICER"], [151, "DEPUTY MANAGER"],
  [152, "DEPUTY MANAGER - ACCOUNTS & TAXATIO"], [153, "ASSISTANT OFFICER"],
  [154, "DEPUTY MANAGER - MIS & ACCOUNTS"], [155, "ASSISTANT GENERAL MANAGER"],
  [156, "SYSTEM ADMIN"], [157, "JR.OFFICER"], [158, "RUNNER"],
  [159, "SCRAP MACHINE OPERATOR"], [160, "VISUAL INSPECTOR"],
  [161, "DOCUMENTATION TRAINEE"], [162, "TECHNICIAN"], [163, "HELPER"],
  [164, "LINE INSPECTOR"], [165, "PRESIDENT"], [166, "CMM ENGINEER"],
  [167, "DESIGN ENGINEER"], [168, "TOOL BOM"], [169, "SR.EXECUTIVE"],
  [170, "IN-CHARGE"], [171, "THREAD ROLLING OPERATOR"],
  [172, "MANAGEMENT TRAINEE"], [173, "SENIOR MANAGER"], [174, "TRAINEE - MR"],
  [175, "VTL OPERATOR"], [176, "GET"], [177, "L1 SUPPORT"],
  [178, "SR.CNC OPERATOR"], [179, "TPM - DATA ENTRY OPERATOR"],
  [180, "GRADUATE ENGINEER TRAINEE"], [181, "SPM OPERATOR"],
  [182, "DEPUTY SENIOR MANAGER"], [183, "SUPERVISOR"], [184, "SETTER"],
  [185, "Y AXIS MACHINE OPERATOR"], [186, "APPRENTICE"],
  [187, "SETTER - JUNIOR"], [188, "CALIBRATION ENGINEER"],
  [189, "VMC SETTER CUM OPERATOR"], [190, "DMG - SETTER CUM OPERATOR"],
  [191, "EXECUTIVE"], [192, "SETTER CUM OPERATOR"],
  [193, "SURFACE GRINDING OPERATOR"], [194, "CYLINDRICAL & SURFACE GRINDING - EN"],
  [195, "SUPPLIER QUALITY ENGINEER"], [196, "CUSTOMER QUALITY ENGINEER"],
  [197, "CARPENTER"], [198, "JR.EXECUTIVE"], [199, "DEBURRING"],
  [200, "VLT OPERATOR"],
];

// From employee classificatin.rpt — EMP_TYPE_REF_NO / EMP_TYPE_NAME
const EMPLOYEE_TYPES = [[1, "INTERN"]];

// From employee classificatin.rpt — GRADE_CODE / GRADE_NAME
const GRADES = [["JE1", "JUNIOR EXECUITVE"], ["GM1", "GENARAL MANAGER"]];

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) : str;
}

try {
  const company = await prisma.company.upsert({
    where: { code: "KUNAERO" },
    update: { name: "KUN AEROSPACE PRIVATE LIMITED" },
    create: { code: "KUNAERO", name: "KUN AEROSPACE PRIVATE LIMITED" },
  });
  console.log(`Company: ${company.code} (id ${company.id})`);

  for (const [code, name] of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: String(code) },
      update: { name: truncate(name, 100) },
      create: { code: String(code), name: truncate(name, 100) },
    });
  }
  console.log(`Departments upserted: ${DEPARTMENTS.length}`);

  for (const [code, name] of DESIGNATIONS) {
    await prisma.designation.upsert({
      where: { code: String(code) },
      update: { name: truncate(name, 100) },
      create: { code: String(code), name: truncate(name, 100) },
    });
  }
  console.log(`Designations upserted: ${DESIGNATIONS.length}`);

  for (const [code, name] of EMPLOYEE_TYPES) {
    await prisma.employeeType.upsert({
      where: { code: String(code) },
      update: { name },
      create: { code: String(code), name },
    });
  }
  console.log(`Employee types upserted: ${EMPLOYEE_TYPES.length}`);

  for (const [code, name] of GRADES) {
    await prisma.grade.upsert({
      where: { code },
      update: { name: truncate(name, 100) },
      create: { code, name: truncate(name, 100) },
    });
  }
  console.log(`Grades upserted: ${GRADES.length}`);

  console.log("\nDone.");
} finally {
  await prisma.$disconnect();
}
