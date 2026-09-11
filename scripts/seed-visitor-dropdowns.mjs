/**
 * Seeds Visitor module dropdown options into DropdownMaster.
 * Run once after the VisitorGatePass migration.
 */

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

for (const line of readFileSync(`${root}/.env`, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const SEED = [
  { category: "visitor_type", label: "CUSTOMER", value: "CUSTOMER", sortOrder: 1 },
  { category: "visitor_type", label: "SUPPLIER", value: "SUPPLIER", sortOrder: 2 },
  { category: "visitor_type", label: "SUBCONTRACTOR", value: "SUBCONTRACTOR", sortOrder: 3 },
  { category: "visitor_type", label: "CONSULTANT", value: "CONSULTANT", sortOrder: 4 },
  { category: "visitor_type", label: "BANKERS", value: "BANKERS", sortOrder: 5 },
  { category: "visitor_type", label: "GOVERNMENT BODIES", value: "GOVERNMENT_BODIES", sortOrder: 6 },
  { category: "visitor_type", label: "LOCAL PEOPLE", value: "LOCAL_PEOPLE", sortOrder: 7 },

  { category: "visitor_purpose", label: "MATERIAL DELIVERY", value: "MATERIAL_DELIVERY", sortOrder: 1 },
  { category: "visitor_purpose", label: "DISPATCH / PICKUP", value: "DISPATCH_PICKUP", sortOrder: 2 },
  { category: "visitor_purpose", label: "MACHINE SERVICE / MAINTENANCE", value: "MACHINE_SERVICE_MAINTENANCE", sortOrder: 3 },
  { category: "visitor_purpose", label: "CLIENT / BUSINESS MEETING", value: "CLIENT_BUSINESS_MEETING", sortOrder: 4 },
  { category: "visitor_purpose", label: "QUALITY INSPECTION / AUDIT", value: "QUALITY_INSPECTION_AUDIT", sortOrder: 5 },
  { category: "visitor_purpose", label: "INSTALLATION / COMMISSIONING", value: "INSTALLATION_COMMISSIONING", sortOrder: 6 },
  { category: "visitor_purpose", label: "TRAINING / DEMO", value: "TRAINING_DEMO", sortOrder: 7 },

  { category: "visitor_food_category", label: "CANTEEN", value: "CANTEEN", sortOrder: 1 },
  { category: "visitor_food_category", label: "SPECIAL", value: "SPECIAL", sortOrder: 2 },

  { category: "visitor_food_type", label: "VEGETERIAN", value: "VEGETERIAN", sortOrder: 1 },
  { category: "visitor_food_type", label: "NON-VEGETERIAN", value: "NON_VEGETARIAN", sortOrder: 2 },

  { category: "visitor_gadgets", label: "ALLOWED", value: "ALLOWED", sortOrder: 1 },
  { category: "visitor_gadgets", label: "NOT ALLOWED", value: "NOT_ALLOWED", sortOrder: 2 },
  { category: "visitor_gadgets", label: "WILL PROVIDE", value: "WILL_PROVIDE", sortOrder: 3 },
];

for (const row of SEED) {
  const existing = await prisma.dropdownMaster.findFirst({
    where: { category: row.category, value: row.value, deletedAt: null },
  });
  if (existing) continue;
  await prisma.dropdownMaster.create({ data: row });
}

console.log(`Seeded ${SEED.length} visitor dropdown options.`);

await prisma.$disconnect();
