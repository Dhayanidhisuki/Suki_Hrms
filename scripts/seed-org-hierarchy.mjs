/**
 * BRD 01 §5.3 worked example for KUN Aerospace (company code KUNAERO):
 *
 *   Business Units  BU-AERO, BU-PREC, BU-CORP
 *   Units           UNIT-HSR (Tamil Nadu), UNIT-BLR (Karnataka)
 *   Sites           SITE-HSR1, SITE-HSR2, SITE-BLR1, SITE-BLR2
 *   Locations       LOC-HSR1-P1 … LOC-BLR2-SB (six, typed)
 *   Cost Centres    CC-3100 … CC-6100, linked to the existing departments by
 *                   name (Department is a global master with numeric codes in
 *                   this tenant — the BRD's DEP-* codes are NOT re-created).
 *   Sub-Departments the BRD's sub-departments under those matched departments.
 *
 * Idempotent: every row is upserted by its unique code; re-running changes
 * nothing. Nothing outside this set is touched.
 *
 *   node scripts/seed-org-hierarchy.mjs
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

const company = await prisma.company.findFirst({ where: { code: "KUNAERO", deletedAt: null }, select: { id: true, code: true } });
if (!company) {
  console.error("Company KUNAERO not found — run scripts/seed-company-and-org.mjs first.");
  process.exit(1);
}
const companyId = company.id;

const BUSINESS_UNITS = [
  ["BU-AERO", "Aerostructures"],
  ["BU-PREC", "Precision Machining"],
  ["BU-CORP", "Corporate"],
];
const UNITS = [
  // code, name, businessUnit, state
  ["UNIT-HSR", "Hosur Works", "BU-AERO", "Tamil Nadu"],
  ["UNIT-BLR", "Bengaluru Works", "BU-PREC", "Karnataka"],
];
const SITES = [
  // code, name, unit, city, state
  ["SITE-HSR1", "Hosur Phase 1", "UNIT-HSR", "Hosur", "Tamil Nadu"],
  ["SITE-HSR2", "Hosur Phase 2", "UNIT-HSR", "Hosur", "Tamil Nadu"],
  ["SITE-BLR1", "Peenya Campus", "UNIT-BLR", "Bengaluru", "Karnataka"],
  ["SITE-BLR2", "Whitefield Office", "UNIT-BLR", "Bengaluru", "Karnataka"],
];
const LOCATIONS = [
  // code, name, site, type
  ["LOC-HSR1-P1", "Hosur Plant 1", "SITE-HSR1", "PLANT"],
  ["LOC-HSR1-W1", "Hosur Stores Warehouse", "SITE-HSR1", "WAREHOUSE"],
  ["LOC-HSR2-P2", "Hosur Plant 2", "SITE-HSR2", "PLANT"],
  ["LOC-BLR1-P3", "Peenya Plant 3", "SITE-BLR1", "PLANT"],
  ["LOC-BLR2-HO", "Corporate Office", "SITE-BLR2", "CORPORATE_OFFICE"],
  ["LOC-BLR2-SB", "Sales Branch Bengaluru", "SITE-BLR2", "BRANCH"],
];
// BRD department → candidate existing department names (first match wins) → sub-departments → cost centre
const DEPARTMENTS = [
  { brd: "DEP-PRD Production", names: ["PRODUCTION"], subs: ["CNC Machining", "VMC Machining", "Assembly"], cc: ["CC-3100", "Production Direct"] },
  { brd: "DEP-QLY Quality", names: ["QUALITY"], subs: ["CMM Inspection", "In-Process Inspection", "NDT"], cc: ["CC-3200", "Quality"] },
  { brd: "DEP-MNT Maintenance", names: ["MAINTENANCE"], subs: ["Electrical", "Mechanical", "Tool Room"], cc: ["CC-3300", "Plant Maintenance"] },
  { brd: "DEP-STR Stores", names: ["STORE", "STORES"], subs: ["Raw Material", "Finished Goods"], cc: ["CC-3400", "Stores"] },
  { brd: "DEP-HRA Human Resources", names: ["HR & ADMIN", "HR", "Human Resources"], subs: ["Time Office", "Talent Acquisition"], cc: ["CC-5100", "HR Admin"] },
  { brd: "DEP-FIN Finance", names: ["ACCOUNTS", "Finance", "FINANCE"], subs: ["Accounts", "Costing"], cc: ["CC-5200", "Finance"] },
  { brd: "DEP-SLS Sales", names: ["SALES"], subs: ["Domestic", "Export"], cc: ["CC-6100", "Sales"] },
];

const buIds = {};
for (const [code, name] of BUSINESS_UNITS) {
  const row = await prisma.businessUnit.upsert({
    where: { companyId_code: { companyId, code } },
    update: { name, isActive: true, deletedAt: null },
    create: { companyId, code, name, description: "BRD §5.3 worked example" },
  });
  buIds[code] = row.id;
}

const unitIds = {};
for (const [code, name, bu, state] of UNITS) {
  const row = await prisma.unit.upsert({
    where: { companyId_code: { companyId, code } },
    update: { name, businessUnitId: buIds[bu], isActive: true, deletedAt: null },
    create: { companyId, code, name, businessUnitId: buIds[bu], description: `Statutory establishment — ${state}` },
  });
  unitIds[code] = row.id;
}

const siteIds = {};
for (const [code, name, unit, city, state] of SITES) {
  const row = await prisma.site.upsert({
    where: { code },
    update: { name, companyId, unitId: unitIds[unit], city, state, isActive: true, deletedAt: null },
    create: { companyId, code, name, unitId: unitIds[unit], city, state },
  });
  siteIds[code] = row.id;
}

for (const [code, name, site, locationType] of LOCATIONS) {
  await prisma.location.upsert({
    where: { companyId_code: { companyId, code } },
    update: { name, siteId: siteIds[site], locationType, isActive: true, deletedAt: null },
    create: { companyId, code, name, siteId: siteIds[site], locationType },
  });
}

const departments = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true } });
let subCreated = 0;
for (const dep of DEPARTMENTS) {
  const match = departments.find((d) => dep.names.some((n) => d.name.trim().toUpperCase() === n.toUpperCase()));
  if (!match) {
    console.warn(`  ! no existing department matches ${dep.brd} — cost centre seeded without a department link`);
  }
  await prisma.costCentre.upsert({
    where: { companyId_code: { companyId, code: dep.cc[0] } },
    update: { name: dep.cc[1], departmentId: match?.id ?? null, isActive: true, deletedAt: null },
    create: { companyId, code: dep.cc[0], name: dep.cc[1], departmentId: match?.id ?? null, description: `Owning department: ${dep.brd}` },
  });
  if (!match) continue;
  for (let i = 0; i < dep.subs.length; i++) {
    const code = `${match.code}-${String(i + 1).padStart(3, "0")}`.slice(0, 20);
    const existing = await prisma.subDepartment.findFirst({ where: { departmentId: match.id, name: dep.subs[i] } });
    if (existing) continue;
    const codeTaken = await prisma.subDepartment.findUnique({ where: { departmentId_code: { departmentId: match.id, code } } });
    if (codeTaken) continue; // keep the tenant's own sub-department under that code
    await prisma.subDepartment.create({ data: { departmentId: match.id, code, name: dep.subs[i] } });
    subCreated++;
  }
}

console.log("seed-org-hierarchy (KUNAERO):", {
  businessUnits: await prisma.businessUnit.count({ where: { companyId } }),
  units: await prisma.unit.count({ where: { companyId, deletedAt: null } }),
  sites: await prisma.site.count({ where: { companyId, deletedAt: null } }),
  locations: await prisma.location.count({ where: { companyId } }),
  costCentres: await prisma.costCentre.count({ where: { companyId } }),
  subDepartmentsCreatedThisRun: subCreated,
});
await prisma.$disconnect();
