/*  Suki HRMS — seed org/lookup master tables from the ERP extract
    Generated 31 August 2026. Source: scripts/erp-extract/out/extract-full.txt
    (Section 6, JSON export) and scripts/erp-extract/out/recover-classification.txt.

    Batched + resumable: 2 DB round trips per table (read existing codes, bulk
    insert the missing ones) instead of one round trip per row, and each
    table is isolated in try/catch so a dropped connection on one table
    doesn't erase progress already made on the tables before it. Always safe
    to just re-run the same command — it only inserts rows that aren't
    already there.

    Targets `suki_hrms` via DATABASE_URL in .env. Run from your own Mac
    Terminal (this project's own shells can't reach the DB host):

      cd ~/CascadeProjects/HRMS
      node scripts/erp-extract/seed-masters.js

    Scope: Company, Unit, Department, Designation, Grade, EmployeeType,
    Category, SalaryComponent. Nothing employee-level yet — that phase is
    still queued behind the open Job Profile / salary-structure / CTC
    decisions in docs/REQUIREMENTS_DECISIONS.md.

    Flagged for review, not silently decided:
      - SalaryComponent `type` (earning/deduction) is NOT in the ERP data —
        classified here by name/semantics. ESI/PF/LIC/LWF/OTHER_DED2 -> deduction,
        everything else -> earning. ATTENDANCE1/ATTENDANCE2 ("Attendance Bonus if
        N day(s) leave") are genuinely ambiguous — filed as earning, please confirm.
      - Component FDA's source display name is literally "SRA" (duplicate of
        component SRA's name) in the ERP master itself — preserved as-is.
      - Grade names keep the ERP's own spelling ("GENARAL MANAGER", "JUNIOR
        EXECUITVE") — real typos in the source master, not introduced here.
      - Category has no ERP master table at all; seeded with the one real
        value found on live employee records (EMP_CAT = "EMPLOYEE", 468/479).
      - Unit/COMPANY_CHILD_UNIT_DETAILS is empty in the ERP; the 3 units below
        are reconstructed from free-text UNIT_NAME values actually in use on
        employee records (main site = 437, UNIT-1 = 4, UNIT-2 = 4; the 34
        "-Select-" placeholder rows are excluded, not a real unit).
      - EmployeeType master only had "INTERN" defined; "PERMANENT" is added
        here because 471/479 live employees actually carry that value.
      - Level: HRMS_DESIG_MASTER carries a real LEVEL column (L1-L7 range
        was offered in the UI, but only L3/L4/L5/L6/L7 ever actually got used —
        85/100 designations have it blank, so L1/L2 are seeded as nothing since
        no live data supports them existing).
      - ShiftMaster: GENERAL is unambiguous (09:00-18:00, from
        HRMS_SHIFT_MASTER, matches its own stated 9-hour duration exactly).
        SHIFT_1/2/3 timings are partly INFERRED — see each shift's own
        `description` field below for exactly what's real vs. reconciled
        from an internally-inconsistent source row. Flagged for the
        client to verify, not confirmed fact.
      - Sub Department is intentionally NOT seeded — the ERP's own
        CLASS_SUB_DEPT master table is empty (0 rows). Nothing to seed;
        this is a real gap in the source data, not a bug in this script.
*/

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const company = { code: 'KUN AERO', name: 'KUN AEROSPACE PRIVATE LIMITED' };

const units = [
  { code: 'MAIN', name: 'KUN Aerospace Private Limited' },
  { code: 'UNIT-1', name: 'UNIT-1' },
  { code: 'UNIT-2', name: 'UNIT-2' },
];

const departments = [
  { code: "20", name: "SALES" },
  { code: "30", name: "HR" },
  { code: "40", name: "PRODUCTION" },
  { code: "50", name: "ACCOUNTS" },
  { code: "60", name: "QUALITY" },
  { code: "70", name: "PLANNING" },
  { code: "80", name: "PACKING" },
  { code: "90", name: "PURCHASE" },
  { code: "100", name: "DESPATCH" },
  { code: "110", name: "EXPORTS & LOGISTICS" },
  { code: "120", name: "DRIVER" },
  { code: "130", name: "HOUSE KEEPING" },
  { code: "140", name: "DEBURRING" },
  { code: "150", name: "WELDING" },
  { code: "160", name: "ADMINISTRATOR" },
  { code: "170", name: "MPLD" },
  { code: "180", name: "OPERATIONS" },
  { code: "190", name: "STORE" },
  { code: "210", name: "FINAL INSPECTION" },
  { code: "220", name: "MAINTENANCE" },
  { code: "230", name: "ENGINEERING & PROJECTS" },
  { code: "240", name: "ADMINISTRATION" },
  { code: "250", name: "MANAGEMENT REPRESENTATIVE" },
  { code: "260", name: "PROJECTS - DMG" },
  { code: "270", name: "EXECUTIVE DIRECTOR" },
  { code: "280", name: "SUPPLY CHAIN" },
  { code: "290", name: "HR & ADMIN" },
  { code: "300", name: "IT & SYSTEM" },
  { code: "310", name: "COSTING & ESTIMATIONS" },
  { code: "320", name: "ENGINEERING" },
  { code: "330", name: "WIP" },
  { code: "340", name: "PPC" },
];

const designations = [
  { code: "100", name: "HR MANGAR" },
  { code: "101", name: "QUALITY ENGINEER" },
  { code: "102", name: "STORES INCHARGE" },
  { code: "104", name: "QUALITY INSPECTOR" },
  { code: "105", name: "PURCHASE INCHARGE" },
  { code: "106", name: "SALES INCHARGE" },
  { code: "107", name: "DESPATCH INCHARGE" },
  { code: "108", name: "SENIOR QA ENGINEER" },
  { code: "109", name: "STORES EXECUTIVE" },
  { code: "110", name: "MR" },
  { code: "111", name: "NPD ENGINEER" },
  { code: "112", name: "TRAINEE - LINE INSPECTOR" },
  { code: "113", name: "DIRECTOR" },
  { code: "114", name: "MANAGER - ACCOUNTS" },
  { code: "115", name: "GENERAL MANAGER" },
  { code: "116", name: "OPERATOR" },
  { code: "117", name: "HOUSE KEEPING" },
  { code: "118", name: "PRODUCTION INCHARGE" },
  { code: "119", name: "STORE INCHARGE" },
  { code: "120", name: "QUALITY MANAGER" },
  { code: "121", name: "PRODUCTION MANAGER" },
  { code: "122", name: "STORE HELPER" },
  { code: "123", name: "SHIFT INCHARGE" },
  { code: "124", name: "QUALITY INCHARGE" },
  { code: "125", name: "FINAL INSPECTOR" },
  { code: "126", name: "PACKING" },
  { code: "127", name: "INCOMING QUALITY" },
  { code: "128", name: "DRIVER" },
  { code: "129", name: "JUNIOR ACCOUNTANT" },
  { code: "130", name: "MAINTENANCE" },
  { code: "131", name: "HR MANAGER" },
  { code: "132", name: "ASSISTANT MANAGER" },
  { code: "133", name: "ENGINEER" },
  { code: "134", name: "SR.ENGINEER" },
  { code: "135", name: "MANAGER" },
  { code: "136", name: "TRAINER" },
  { code: "137", name: "TRAINEE" },
  { code: "138", name: "SR.TECHNICIAN" },
  { code: "139", name: "ASSISTANT ENGINEER" },
  { code: "140", name: "JR.ENGINEER" },
  { code: "141", name: "ASSISTANT" },
  { code: "142", name: "CNC OPERATOR" },
  { code: "143", name: "MANAGEMENT REPRESENTATIVE" },
  { code: "144", name: "CUTTING MACHINE OPERATOR" },
  { code: "145", name: "DMG MACHINE OPERATOR" },
  { code: "146", name: "VMC OPERATOR" },
  { code: "147", name: "EXECUTIVE DIRECTOR" },
  { code: "148", name: "VICE PRESIDENT" },
  { code: "149", name: "PROGRAMME MANAGER" },
  { code: "150", name: "OFFICER" },
  { code: "151", name: "DEPUTY MANAGER" },
  { code: "152", name: "DEPUTY MANAGER - ACCOUNTS & TAXATIO" },
  { code: "153", name: "ASSISTANT OFFICER" },
  { code: "154", name: "DEPUTY MANAGER - MIS & ACCOUNTS" },
  { code: "155", name: "ASSISTANT GENERAL MANAGER" },
  { code: "156", name: "SYSTEM ADMIN" },
  { code: "157", name: "JR.OFFICER" },
  { code: "158", name: "RUNNER" },
  { code: "159", name: "SCRAP MACHINE OPERATOR" },
  { code: "160", name: "VISUAL INSPECTOR" },
  { code: "161", name: "DOCUMENTATION TRAINEE" },
  { code: "162", name: "TECHNICIAN" },
  { code: "163", name: "HELPER" },
  { code: "164", name: "LINE INSPECTOR" },
  { code: "165", name: "PRESIDENT" },
  { code: "166", name: "CMM ENGINEER" },
  { code: "167", name: "DESIGN ENGINEER" },
  { code: "168", name: "TOOL BOM" },
  { code: "169", name: "SR.EXECUTIVE" },
  { code: "170", name: "IN-CHARGE" },
  { code: "171", name: "THREAD ROLLING OPERATOR" },
  { code: "172", name: "MANAGEMENT TRAINEE" },
  { code: "173", name: "SENIOR MANAGER" },
  { code: "174", name: "TRAINEE - MR" },
  { code: "175", name: "VTL OPERATOR" },
  { code: "176", name: "GET" },
  { code: "177", name: "L1 SUPPORT" },
  { code: "178", name: "SR.CNC OPERATOR" },
  { code: "179", name: "TPM - DATA ENTRY OPERATOR" },
  { code: "180", name: "GRADUATE ENGINEER TRAINEE" },
  { code: "181", name: "SPM OPERATOR" },
  { code: "182", name: "DEPUTY SENIOR MANAGER" },
  { code: "183", name: "SUPERVISOR" },
  { code: "184", name: "SETTER" },
  { code: "185", name: "Y AXIS MACHINE OPERATOR" },
  { code: "186", name: "APPRENTICE" },
  { code: "187", name: "SETTER - JUNIOR" },
  { code: "188", name: "CALIBRATION ENGINEER" },
  { code: "189", name: "VMC SETTER CUM OPERATOR" },
  { code: "190", name: "DMG - SETTER CUM OPERATOR" },
  { code: "191", name: "EXECUTIVE" },
  { code: "192", name: "SETTER CUM OPERATOR" },
  { code: "193", name: "SURFACE GRINDING OPERATOR" },
  { code: "194", name: "CYLINDRICAL & SURFACE GRINDING - EN" },
  { code: "195", name: "SUPPLIER QUALITY ENGINEER" },
  { code: "196", name: "CUSTOMER QUALITY ENGINEER" },
  { code: "197", name: "CARPENTER" },
  { code: "198", name: "JR.EXECUTIVE" },
  { code: "199", name: "DEBURRING" },
  { code: "200", name: "VLT OPERATOR" },
];

const grades = [
  { code: "GM1", name: "GENARAL MANAGER" },
  { code: "JE1", name: "JUNIOR EXECUITVE" },
];

const employeeTypes = [
  { code: 'INTERN', name: 'INTERN' },
  { code: 'PERMANENT', name: 'PERMANENT' },
];

const categories = [
  { code: 'EMPLOYEE', name: 'Employee' },
];

const levels = [
  { code: 'L3', name: 'L3' },
  { code: 'L4', name: 'L4' },
  { code: 'L5', name: 'L5' },
  { code: 'L6', name: 'L6' },
  { code: 'L7', name: 'L7' },
];

const salaryComponents = [
  { code: "BASIC", name: "Basic Salary", type: "earning" },
  { code: "SRA", name: "SRA", type: "earning" },
  { code: "QA", name: "QA", type: "earning" },
  { code: "FDA", name: "SRA", type: "earning" },
  { code: "SNACKS", name: "Snacks Allowance", type: "earning" },
  { code: "CONVEYANCE", name: "Conv.Allow", type: "earning" },
  { code: "SPL_ALLOW", name: "Spl.Allowance", type: "earning" },
  { code: "HEAT", name: "Heat Allowance", type: "earning" },
  { code: "WASH", name: "Wash Allowance", type: "earning" },
  { code: "HRA", name: "HRA", type: "earning" },
  { code: "NIGHT_SHIFT", name: "Night Shift Allowance", type: "earning" },
  { code: "DA", name: "DA", type: "earning" },
  { code: "EDUCATION", name: "Education Allowance", type: "earning" },
  { code: "ATTENDANCE", name: "Attendance Incentive for 100% Attendance", type: "earning" },
  { code: "ADD_HRA", name: "Additional HRA", type: "earning" },
  { code: "HEALTH", name: "Health Allowance", type: "earning" },
  { code: "CANTEEN", name: "Canteen Allowance", type: "earning" },
  { code: "GUEST_HOUSE", name: "Guest.House Allowance", type: "earning" },
  { code: "CCA", name: "CCA", type: "earning" },
  { code: "DIS_LOCATION", name: "Dis.Location.Allow", type: "earning" },
  { code: "OTHER1", name: "Other Allowance", type: "earning" },
  { code: "OTHER2", name: "Other Allowance 2", type: "earning" },
  { code: "OTHER3", name: "Other Allowance 3", type: "earning" },
  { code: "LUNCH_PER_DAY", name: "Lunch Allowance Per/Day", type: "earning" },
  { code: "FOOD", name: "Food Allowance", type: "earning" },
  { code: "PROD_INS", name: "Prod.Incentive", type: "earning" },
  { code: "PERFORMANCE_INS", name: "Performance Incentive", type: "earning" },
  { code: "PERFORMANCE", name: "Performance Allowance", type: "earning" },
  { code: "ESI", name: "Esi Allowance", type: "deduction" },
  { code: "PF", name: "PF", type: "deduction" },
  { code: "LIC", name: "LIC", type: "deduction" },
  { code: "LWF", name: "LWF", type: "deduction" },
  { code: "ATTENDANCE1", name: "Attendance Bonus if 1 day leave", type: "earning" },
  { code: "ATTENDANCE2", name: "Attendance Bonus if 2 days leave", type: "earning" },
  { code: "OTHER_DED2", name: "Other Deduction2", type: "deduction" },
];

const shifts = [
  {
    code: 'GENERAL',
    name: 'General Shift',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 0,
    description: 'From HRMS_SHIFT_MASTER — unambiguous (9.00 to 18.00, matches its own 9-hour SHIFT_TIME).',
  },
  {
    code: 'SHIFT_1',
    name: 'Shift 1',
    startTime: '22:30',
    endTime: '06:30',
    graceMinutes: 0,
    description: 'INFERRED to close the 8-hour rotation with Shift 2/3 — HRMS_SHIFT_MASTER stores this boundary as "9.30", which does not reconcile with the stated 8-hour SHIFT_TIME for any AM/PM reading. Please verify the real start time with the client.',
  },
  {
    code: 'SHIFT_2',
    name: 'Shift 2',
    startTime: '06:30',
    endTime: '14:30',
    graceMinutes: 0,
    description: 'From HRMS_SHIFT_MASTER — matches its own raw 6.30/2.30 boundary values and 8-hour SHIFT_TIME exactly.',
  },
  {
    code: 'SHIFT_3',
    name: 'Shift 3',
    startTime: '14:30',
    endTime: '22:30',
    graceMinutes: 0,
    description: 'From HRMS_SHIFT_MASTER — start matches its own raw 2.30 boundary value exactly; end (22:30) inferred, same reasoning as Shift 1.',
  },
];

async function insertMissing(label, rows, model) {
  try {
    const existingRows = await model.findMany({ select: { code: true } });
    const existingCodes = new Set(existingRows.map((r) => r.code));
    const toInsert = rows.filter((r) => !existingCodes.has(r.code));
    if (toInsert.length > 0) {
      await model.createMany({ data: toInsert });
    }
    console.log(`${label}: ${toInsert.length} inserted, ${rows.length - toInsert.length} already present (${rows.length} total)`);
    return true;
  } catch (e) {
    console.error(`${label}: FAILED - ${e.message.split(String.fromCharCode(10))[0]}`);
    return false;
  }
}

async function main() {
  const results = {};

  try {
    const companyRow = await prisma.company.upsert({
      where: { code: company.code },
      update: {},
      create: company,
    });
    console.log(`Company: ${companyRow.name} (id ${companyRow.id})`);
    results.company = true;

    const existingUnits = await prisma.unit.findMany({ select: { code: true } });
    const existingUnitCodes = new Set(existingUnits.map((u) => u.code));
    const unitsToInsert = units
      .filter((u) => !existingUnitCodes.has(u.code))
      .map((u) => ({ ...u, companyId: companyRow.id }));
    if (unitsToInsert.length > 0) {
      await prisma.unit.createMany({ data: unitsToInsert });
    }
    console.log(`Unit: ${unitsToInsert.length} inserted, ${units.length - unitsToInsert.length} already present (${units.length} total)`);
    results.unit = true;
  } catch (e) {
    console.error(`Company/Unit: FAILED - ${e.message.split(String.fromCharCode(10))[0]}`);
    results.company = false;
    results.unit = false;
  }

  results.department = await insertMissing('Department', departments, prisma.department);
  results.designation = await insertMissing('Designation', designations, prisma.designation);
  results.grade = await insertMissing('Grade', grades, prisma.grade);
  results.level = await insertMissing('Level', levels, prisma.level);
  results.shift = await insertMissing('ShiftMaster', shifts, prisma.shiftMaster);
  results.employeeType = await insertMissing('EmployeeType', employeeTypes, prisma.employeeType);
  results.category = await insertMissing('Category', categories, prisma.category);
  results.salaryComponent = await insertMissing('SalaryComponent', salaryComponents, prisma.salaryComponent);

  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length > 0) {
    console.log(`Incomplete - just re-run the same command, it will pick up where this left off: ${failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Done - all tables seeded.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
