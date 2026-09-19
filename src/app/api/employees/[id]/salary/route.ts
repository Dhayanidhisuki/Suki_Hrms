/**
 * GET  /api/employees/[id]/salary   — full salary revision history, newest
 *                                      first, each with its component breakdown
 * POST /api/employees/[id]/salary   — add a new revision effective from a
 *                                      given date. Closes whatever revision
 *                                      was current (effectiveTo = new row's
 *                                      effectiveFrom) so the two ranges meet
 *                                      but never overlap — tr_EmployeeSalaryRevision_no_overlap
 *                                      is the DB-level backstop if that logic
 *                                      is ever bypassed. Revisions are
 *                                      immutable history — no PUT/DELETE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { salaryRevisionSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';
import { applySalaryRevision } from '@/lib/salaryRevisioning';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);

  const [data, employee] = await Promise.all([
    prisma.employeeSalaryRevision.findMany({
      where: { employeeId },
      include: { components: { include: { salaryComponent: { select: { name: true, code: true, type: true, grossTier: true } } } } },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.employee.findFirst({
      where: { id: employeeId },
      select: {
        companyId: true,
        jobInfos: { where: { effectiveTo: null }, take: 1, select: { pfApplicable: true, esiApplicable: true, pfRestrictionAmount: true, bonusApplicable: true } },
      },
    }),
  ]);

  // deductionContext — everything the Salary Details tab needs to preview
  // PF/ESI/other-deduction amounts using the SAME formula payrollCalculation.ts
  // uses for a real run: PF/ESI Rate's own top-level Employee Rate % applied
  // to a wage base, and active DeductionRate rows (PERCENT of gross, or FLAT)
  // matched to a SalaryComponent by code for display. This is a live preview
  // only — the actual payroll run recomputes for real with LOP/attendance
  // context this page doesn't have.
  let deductionContext = null;
  if (employee) {
    const { companyId } = employee;
    // PfRate/EsiRate are NOT company-scoped in this schema (no companyId
    // column — matches how payrollCalculation.ts already queries them);
    // only DeductionRate is.
    const [pfRate, esiRate, deductionRates, exclusions, bonusRate] = await Promise.all([
      prisma.pfRate.findFirst({ where: { isActive: true, effectiveTo: null } }),
      prisma.esiRate.findFirst({ where: { isActive: true, effectiveTo: null } }),
      prisma.deductionRate.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
      prisma.employeeDeductionExclusion.findMany({ where: { employeeId }, select: { deductionCode: true, excluded: true, overrideAmount: true } }),
      prisma.bonusRate.findFirst({ where: { companyId, isActive: true, effectiveTo: null } }),
    ]);
    const overrideByCode = new Map(exclusions.map((e) => [e.deductionCode, { excluded: e.excluded, overrideAmount: e.overrideAmount != null ? Number(e.overrideAmount) : null }]));
    const drCodes = deductionRates.map((d) => d.code);
    const drComponents = drCodes.length
      ? await prisma.salaryComponent.findMany({ where: { companyId, code: { in: drCodes }, deletedAt: null }, select: { code: true, name: true } })
      : [];
    const drNameByCode = new Map(drComponents.map((c) => [c.code, c.name]));

    // PF wage base = sum of the employee's amounts for whichever Salary
    // Components are attached to this PF Rate (Masters > PF Rates > + Add
    // Salary Component), not a per-component includeInPf flag and not the
    // whole Actual Gross.
    const pfRateComponentIds = pfRate
      ? (await prisma.pfRateComponent.findMany({ where: { pfRateId: pfRate.id }, select: { salaryComponentId: true } })).map((c) => c.salaryComponentId)
      : [];

    // Bonus (report) — for each processed payroll month this financial year
    // (Apr–Mar), take that month's real attendance-prorated Basic pay
    // (PayrollLineComponent for code BASIC — already reduced for LOP by
    // payrollCalculation.ts's lopFactor), AVERAGE those monthly figures
    // (not summed — averaging projects correctly to a full year even when
    // fewer than 12 months have been processed yet), × 12, × Bonus Rate's
    // Rate %. Once all 12 months of the year are processed this equals a
    // straight sum × rate — matches the "Earned Basic Salary Summary"
    // report in that case, but also gives a sane mid-year estimate.
    // acYear = the year April fell in for "today" (Jan–Mar counts as the
    // FY that started the previous April).
    const now = new Date();
    const acYear = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const fyMonths: { year: number; month: number }[] = [];
    for (let i = 0, y = acYear, m = 4; i < 12; i++, m++) {
      if (m > 12) { m = 1; y += 1; }
      fyMonths.push({ year: y, month: m });
    }
    const earnedBasicRows = await prisma.payrollLineComponent.findMany({
      where: {
        payrollLine: {
          employeeId,
          payrollRun: { companyId, status: { in: ['CALCULATED', 'APPROVED', 'LOCKED'] }, OR: fyMonths },
        },
        salaryComponent: { code: 'BASIC' },
      },
      select: { amount: true },
    });
    // null = no processed payroll months this FY yet, don't fabricate a figure
    const avgMonthlyEarnedBasic = earnedBasicRows.length
      ? earnedBasicRows.reduce((s, r) => s + Number(r.amount), 0) / earnedBasicRows.length
      : null;

    deductionContext = {
      pfApplicable: employee.jobInfos[0]?.pfApplicable ?? true,
      esiApplicable: employee.jobInfos[0]?.esiApplicable ?? false,
      bonusApplicable: employee.jobInfos[0]?.bonusApplicable ?? false,
      // 0 is treated the same as unset (null) — a zero restriction would
      // otherwise zero out the whole PF wage base instead of meaning "no
      // restriction, use the statutory ceiling" (the help text's promise).
      pfRestrictionAmount:
        employee.jobInfos[0]?.pfRestrictionAmount != null && Number(employee.jobInfos[0].pfRestrictionAmount) > 0
          ? Number(employee.jobInfos[0].pfRestrictionAmount)
          : null,
      pfRateComponentIds,
      pfRate: pfRate ? { employeeContributionRate: Number(pfRate.employeeContributionRate), wageCeilingMonthly: Number(pfRate.wageCeilingMonthly) } : null,
      esiRate: esiRate ? { employeeContributionRate: Number(esiRate.employeeContributionRate), wageCeilingMonthly: Number(esiRate.wageCeilingMonthly) } : null,
      // Bonus (report) = avgMonthlyEarnedBasic × 12 × Rate %. Null
      // avgMonthlyEarnedBasic (no processed payroll months this FY yet)
      // means no figure to show, not a fabricated projection.
      bonusRate: bonusRate ? { ratePercent: Number(bonusRate.ratePercent), calculationWageCeiling: Number(bonusRate.calculationWageCeiling) } : null,
      avgMonthlyEarnedBasic,
      deductionRates: deductionRates.map((d) => {
        const override = overrideByCode.get(d.code);
        return {
          code: d.code,
          name: drNameByCode.get(d.code) ?? d.name,
          deductionType: d.deductionType,
          rateValue: Number(d.rateValue),
          // Per-employee override (Salary Details Deductions panel's Remove/
          // Edit/Add back) — still returned even when excluded, not filtered
          // out server-side, so the UI can show it struck through with an
          // "Add back" action rather than silently hiding it.
          excluded: override?.excluded ?? false,
          overrideAmount: override?.excluded ? null : (override?.overrideAmount ?? null),
        };
      }),
    };
  }

  return NextResponse.json({ data, deductionContext });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true, companyId: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const parsed = salaryRevisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { components, ...revisionFields } = parsed.data;

  if (components.length > 0) {
    const validCount = await prisma.salaryComponent.count({
      where: { id: { in: components.map((c) => c.salaryComponentId) }, companyId: employee.companyId },
    });
    if (validCount !== new Set(components.map((c) => c.salaryComponentId)).size) {
      return NextResponse.json({ error: 'One or more salary components do not belong to this employee\'s company.' }, { status: 400 });
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const revision = await applySalaryRevision(tx, {
        employeeId,
        financialYear: revisionFields.financialYear,
        grossSalary: revisionFields.grossSalary,
        netSalary: revisionFields.netSalary,
        effectiveFrom: revisionFields.effectiveFrom,
        components,
        performedByUserId,
      });
      await logActivity(tx, {
        employeeId,
        activityType: 'salary_revised',
        module: 'salary',
        performedByUserId,
        newValue: { grossSalary: revisionFields.grossSalary, effectiveFrom: revisionFields.effectiveFrom },
        relatedRecordId: revision.id,
      });
      return revision;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Overlap detected')) {
      return NextResponse.json({ error: 'This effective date overlaps an existing salary revision.' }, { status: 409 });
    }
    if (message.includes('must be effective after')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }
}
