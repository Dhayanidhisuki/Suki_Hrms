/**
 * One-off: builds a ready-to-upload copy of the employee bulk-upload
 * template (src/app/employees/bulk-upload/page.tsx), pre-filled with every
 * device user seen on the biometric controller in the last N days (real
 * Device ID + name) and a randomly-assigned Department/Designation/
 * Employee Type/Unit/Category/Grade/Level/Join Date pulled from this
 * company's actual master data (the device itself has no such data — see
 * src/lib/biometricApi.ts). Device users that already match an existing
 * employee's oldEmployeeCode are skipped so re-running this doesn't create
 * duplicates.
 *
 *   node scripts/generate-biometric-employee-template.mjs [outFile]
 */

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const COMPANY_ID = Number(process.env.BIOMETRIC_COMPANY_ID ?? 1);
const LOOKBACK_DAYS = Number(process.argv[3] ?? 180);
const outFile = process.argv[2] ?? "employee-bulk-upload-from-biometric.xlsx";

function normaliseDeviceUserId(raw) {
  return raw.trim().toUpperCase().replace(/^E/, "").replace(/^0+(?=\d)/, "");
}

function formatDeviceDateTime(d, endOfDay) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

async function fetchDeviceUsers(rangeStart, rangeEnd) {
  const base = process.env.BIOMETRIC_API_URL;
  const key = process.env.BIOMETRIC_API_KEY;
  if (!base || !key) throw new Error("BIOMETRIC_API_URL / BIOMETRIC_API_KEY are not configured in .env");

  const url = new URL("/api/v1/attendance", base);
  url.searchParams.set("startDate", formatDeviceDateTime(rangeStart, false));
  url.searchParams.set("endDate", formatDeviceDateTime(rangeEnd, true));
  url.searchParams.set("includeEvents", "false");
  url.searchParams.set("includeDaily", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(url, { headers: { "X-API-Key": key, Accept: "application/json" }, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Device API responded ${res.status} ${res.statusText}`);

  const body = await res.json();
  const rows = body["daily-attendance"];
  if (!Array.isArray(rows)) throw new Error('Device API response has no "daily-attendance" array');

  const byUser = new Map();
  for (const r of rows) {
    if (!r.userid) continue;
    const userid = String(r.userid).trim();
    const username = String(r.username ?? "").trim();
    if (username && !byUser.has(userid)) byUser.set(userid, username);
    else if (username) byUser.set(userid, username); // keep most-recent-seen name
  }
  return byUser; // Map<deviceUserId, username>
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomJoinDateIso() {
  const now = Date.now();
  const twoYearsMs = 2 * 365 * 86400000;
  const d = new Date(now - Math.floor(Math.random() * twoYearsMs));
  return d.toISOString().slice(0, 10);
}

function splitName(username) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Employee" };
  if (parts.length === 1) return { first: parts[0], last: "-" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

try {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) throw new Error(`Company id ${COMPANY_ID} not found`);

  const [departments, designations, employeeTypes, units, categories, grades, levels, existing] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.designation.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.employeeType.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.unit.findMany({ where: { companyId: COMPANY_ID, isActive: true, deletedAt: null } }),
    prisma.category.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.grade.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.level.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.employee.findMany({ where: { companyId: COMPANY_ID, oldEmployeeCode: { not: null } }, select: { oldEmployeeCode: true } }),
  ]);
  if (departments.length === 0 || designations.length === 0 || employeeTypes.length === 0) {
    throw new Error("Company is missing Department/Designation/EmployeeType master data — seed masters first.");
  }

  const existingDeviceIds = new Set(existing.map((e) => normaliseDeviceUserId(e.oldEmployeeCode)));

  const rangeEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const rangeStart = new Date(rangeEnd.getTime() - (LOOKBACK_DAYS - 1) * 86400000);
  console.log(`Fetching device users seen in the last ${LOOKBACK_DAYS} days from ${process.env.BIOMETRIC_API_URL}...`);
  const deviceUsers = await fetchDeviceUsers(rangeStart, rangeEnd);
  console.log(`Found ${deviceUsers.size} distinct device users.`);

  const rows = [];
  for (const [userid, username] of deviceUsers) {
    if (existingDeviceIds.has(normaliseDeviceUserId(userid))) continue; // already an employee
    const { first, last } = splitName(username);
    const dept = pick(departments);
    const desig = pick(designations);
    const type = pick(employeeTypes);
    rows.push([
      userid,
      "",
      first,
      "",
      last,
      company.name,
      units.length ? pick(units).name : "",
      dept.name,
      "",
      desig.name,
      type.name,
      categories.length ? pick(categories).name : "",
      "",
      grades.length ? pick(grades).name : "",
      levels.length ? pick(levels).name : "",
      "active",
      randomJoinDateIso(),
      pick([0, 3, 6]),
      "",
      "GENERAL",
      "",
      "",
      "",
    ]);
  }
  console.log(`${rows.length} rows are new (not already matched to an existing employee).`);

  const TEMPLATE_COLUMNS = [
    "Device ID (Biometric)", "Title", "First Name", "Middle Name", "Last Name", "Company", "Unit / Branch",
    "Department", "Sub Department", "Designation", "Employee Type", "Category", "Subcategory", "Grade", "Level",
    "Status", "Join Date (YYYY-MM-DD)", "Probation Period (Months)", "Reporting Manager Employee Code",
    "Shift Assignment Type (GENERAL/ROTATIONAL)", "Production Line", "Additional Role", "Team Group",
  ];

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, ...rows]);
  sheet["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, sheet, "Employees");

  const refColumns = [
    ["Department", ...departments.map((d) => d.name)],
    ["Designation", ...designations.map((d) => d.name)],
    ["Employee Type", ...employeeTypes.map((d) => d.name)],
    ["Unit / Branch", ...units.map((d) => d.name)],
    ["Category", ...categories.map((d) => d.name)],
    ["Grade", ...grades.map((d) => d.name)],
    ["Level", ...levels.map((d) => d.name)],
  ];
  const maxRows = Math.max(...refColumns.map((c) => c.length));
  const refRows = [];
  for (let r = 0; r < maxRows; r++) refRows.push(refColumns.map((c) => c[r] ?? ""));
  const refSheet = XLSX.utils.aoa_to_sheet(refRows);
  refSheet["!cols"] = refColumns.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(wb, refSheet, "Reference Lists");

  XLSX.writeFile(wb, outFile);
  console.log(`Wrote ${outFile}`);
} finally {
  await prisma.$disconnect();
}
