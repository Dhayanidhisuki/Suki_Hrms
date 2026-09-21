/**
 * Seeds a demo Performance goal set: one cycle, two KRAs, four KPIs covering
 * all three measurement types, an Active template plus a Draft clone, and
 * assignments to a few employees in mixed states.
 *
 * Exists so the Goal Template / Goal Assignment screens have something real to
 * show on a fresh database — the data these screens were demoed with.
 *
 * Idempotent: upserts on the natural keys (code per company), and skips
 * assignment for any employee who already has a set for the cycle.
 *
 *   node scripts/seed-performance-goals-demo.mjs
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

const CYCLE = {
  code: "FY26-27",
  name: "FY 2026-27 Annual Review",
  cycleType: "ANNUAL",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2027-03-31"),
  goalSettingStart: new Date("2026-04-01"),
  goalSettingEnd: new Date("2026-04-30"),
  status: "ACTIVE",
};

const KRAS = [
  { code: "KRA-DEL", name: "Delivery Excellence", category: "Operational",
    description: "On-time, on-spec delivery of assigned production targets", weightage: 60 },
  { code: "KRA-QLY", name: "Quality & Compliance", category: "Quality",
    description: "Defect control and adherence to quality standards", weightage: 40 },
];

// Deliberately spans all three measurement types so the screens exercise each.
const KPIS = [
  { kra: "KRA-DEL", code: "KPI-OTD", name: "On-Time Delivery", description: "Percentage of orders delivered on schedule",
    measurementType: "HIGHER_IS_BETTER", unit: "%", target: 95, minThreshold: 80, maxTarget: 100, weightage: 60, frequency: "MONTHLY" },
  { kra: "KRA-DEL", code: "KPI-SPR", name: "Sprint Completion", description: "Planned production sprints completed",
    measurementType: "HIGHER_IS_BETTER", unit: "count", target: 12, weightage: 40, frequency: "QUARTERLY" },
  { kra: "KRA-QLY", code: "KPI-DEF", name: "Defect Rate", description: "Defects per thousand units produced",
    measurementType: "LOWER_IS_BETTER", unit: "per 1000", target: 3, weightage: 70, frequency: "MONTHLY" },
  { kra: "KRA-QLY", code: "KPI-AUD", name: "Audit Score", description: "Internal quality audit rating",
    measurementType: "RATING_1_5", unit: "Rating", target: 4, minThreshold: 1, maxTarget: 5, weightage: 30, frequency: "HALF_YEARLY" },
];

const TEMPLATE_NAME = "Production Engineer — FY26-27";
const ASSIGN_COUNT = 3;

async function main() {
  const companies = await prisma.company.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true },
  });

  for (const company of companies) {
    const companyId = company.id;

    const employees = await prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
      take: ASSIGN_COUNT,
    });
    if (employees.length === 0) {
      console.log(`  ${company.code}: no employees — skipped`);
      continue;
    }

    const cycle = await upsertByCode(prisma.performanceCycle, companyId, CYCLE.code, { companyId, ...CYCLE });

    const kraByCode = {};
    for (const k of KRAS) {
      kraByCode[k.code] = await upsertByCode(prisma.kra, companyId, k.code, {
        companyId, code: k.code, name: k.name, description: k.description, category: k.category,
        defaultWeightage: k.weightage, status: "ACTIVE", effectiveFrom: CYCLE.startDate,
      });
    }

    const kpiByCode = {};
    for (const p of KPIS) {
      kpiByCode[p.code] = await upsertByCode(prisma.kpi, companyId, p.code, {
        companyId, kraId: kraByCode[p.kra].id, code: p.code, name: p.name, description: p.description,
        measurementType: p.measurementType, unit: p.unit, target: p.target,
        minThreshold: p.minThreshold ?? null, maxTarget: p.maxTarget ?? null,
        weightage: p.weightage, frequency: p.frequency, status: "ACTIVE",
      });
    }

    // Template: Model A — KRAs total 100, KPIs total 100 within each KRA.
    let template = await prisma.goalTemplate.findFirst({ where: { companyId, name: TEMPLATE_NAME } });
    if (!template) {
      template = await prisma.goalTemplate.create({
        data: {
          companyId,
          code: await nextTemplateCode(companyId),
          name: TEMPLATE_NAME,
          description: "Standard goal set for production engineering roles",
          status: "ACTIVE",
          kras: {
            create: KRAS.map((k) => ({
              kraId: kraByCode[k.code].id,
              weightage: k.weightage,
              kpis: {
                create: KPIS.filter((p) => p.kra === k.code).map((p) => ({
                  kpiId: kpiByCode[p.code].id,
                  description: p.description,
                  measurementType: p.measurementType,
                  unit: p.unit,
                  target: p.target,
                  minThreshold: p.minThreshold ?? null,
                  maxTarget: p.maxTarget ?? null,
                  weightage: p.weightage,
                  frequency: p.frequency,
                })),
              },
            })),
          },
        },
      });

      // A Draft clone, so the list shows the "revise an assigned template" path.
      const full = await prisma.goalTemplate.findUnique({
        where: { id: template.id },
        include: { kras: { include: { kpis: true } } },
      });
      await prisma.goalTemplate.create({
        data: {
          companyId,
          code: await nextTemplateCode(companyId),
          name: `Copy of ${full.name}`,
          description: full.description,
          status: "DRAFT",
          clonedFromId: full.id,
          kras: {
            create: full.kras.map((k) => ({
              kraId: k.kraId,
              weightage: k.weightage,
              kpis: {
                create: k.kpis.map(({ id, templateKraId, ...rest }) => rest),
              },
            })),
          },
        },
      });
    }

    const lines = await buildLines(template.id, cycle);
    let assigned = 0;
    for (const [i, emp] of employees.entries()) {
      const existing = await prisma.employeeGoalSet.findFirst({
        where: { companyId, employeeId: emp.id, cycleId: cycle.id },
        select: { id: true },
      });
      if (existing) continue;
      // First employee accepts, so the list shows mixed statuses.
      const accepted = i === 0;
      await prisma.employeeGoalSet.create({
        data: {
          companyId, employeeId: emp.id, cycleId: cycle.id, templateId: template.id,
          status: accepted ? "ACCEPTED" : "PENDING_ACCEPTANCE",
          submittedAt: new Date(),
          acceptedAt: accepted ? new Date() : null,
          kras: { create: lines },
        },
      });
      assigned += 1;
    }
    console.log(`  ${company.code}: cycle+${KRAS.length} KRAs+${KPIS.length} KPIs ready, ${assigned} assignment(s) created`);
  }
}

async function upsertByCode(model, companyId, code, data) {
  const found = await model.findFirst({ where: { companyId, code } });
  if (found) return model.update({ where: { id: found.id }, data });
  return model.create({ data });
}

async function nextTemplateCode(companyId) {
  const rows = await prisma.goalTemplate.findMany({ where: { companyId }, select: { code: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^GT-(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `GT-${String(max + 1).padStart(4, "0")}`;
}

async function buildLines(templateId, cycle) {
  const t = await prisma.goalTemplate.findUnique({
    where: { id: templateId },
    include: { kras: { include: { kpis: true }, orderBy: { id: "asc" } } },
  });
  return t.kras.map((k) => ({
    kraId: k.kraId,
    weightage: k.weightage,
    kpis: {
      create: k.kpis.map((p) => ({
        kpiId: p.kpiId, description: p.description, measurementType: p.measurementType,
        unit: p.unit, target: p.target, minThreshold: p.minThreshold, maxTarget: p.maxTarget,
        weightage: p.weightage, frequency: p.frequency,
        startDate: cycle.startDate, endDate: cycle.endDate,
      })),
    },
  }));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
