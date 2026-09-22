/**
 * OT & Other Incentive Register — the automated replacement for KUN's
 * manually maintained "Overtime Salary Register" workbook.
 *
 * Column set matches that workbook's "Salary Export" sheet one-for-one:
 *   Sl No / Emp ID / Employee Name / Month-Year / Category / Department /
 *   Designation / Date of Joining / Gender / Basic (Th) / OT Hrs / OT Value /
 *   OT Amount / OT Mon Incentive / OT Weekly Inc / DM_INC / ATT_BONUS /
 *   Shift Incentive / Employee Referral / Tot OC Ear / OC Empl ESI /
 *   OC Emplr ESI / Tot OC Net / Bank A/c No / Bank IFSC / Bank Name / Remarks
 *
 * Two further columns — Petrol Allowance and Performance Incentive — are
 * carried over from the previous version of this report. They have no
 * counterpart in the manual workbook and are deliberately NOT part of
 * Tot OC Ear, which must keep matching the workbook's own formula.
 *
 * Verified against the February'2026 workbook:
 *   Tot OC Ear = OT Amount + OT Mon Inc + OT Weekly Inc + DM_INC +
 *                ATT_BONUS + Shift Incentive + Employee Referral
 *     — holds for 437 of its 438 rows. The one exception (Emp 17, ₹7,497.83
 *       of OT excluded by hand) is an undocumented manual override and is
 *       deliberately NOT reproduced here.
 *   Tot OC Net = Tot OC Ear − OC Empl ESI
 *   OT Value   = OT Amount / OT Hrs  (the effective hourly OT rate)
 *   OC ESI     = 0.75% / 3.25% of Tot OC Ear for ESI-covered employees
 *
 * ── Where each figure comes from ──────────────────────────────────────
 * OT Hrs / OT Amount / OT Mon Incentive come from computeEmployeeOtForMonth
 * — the same function calculatePayrollRun itself calls — so they carry
 * payroll's status filter, threshold, rounding slab, daily/weekly/monthly
 * caps and slab match. They are never re-derived from raw attendance here.
 * PayrollLine stores the amount but not the hours, so all three come from
 * one call rather than mixing a stored amount with recomputed hours; the
 * recomputed amount is cross-checked against PayrollLine.otAmount and any
 * disagreement is reported as staleness (see `staleOtRows`) rather than
 * silently papered over.
 *
 * DM_INC / ATT_BONUS / Shift Incentive / OT Weekly Inc / Employee Referral
 * all originate in Workforce > Benefits > Double Machine Incentive
 * (/payroll/processing/double-machine → the DoubleMachineIncentive table).
 * Payroll reads that module directly and pays its `complete` rows, writing a
 * PayrollLineComponent for each, so the component is the authoritative
 * "actually paid" figure and is what this register shows.
 *
 * The module value is the fallback, used when payroll produced no component
 * — a period with no run yet, or a row still in `process`. Every cell records
 * which of the two produced it so a keyed-but-unpaid amount is never mistaken
 * for a paid one. A `hold` row pays zero on both sides.
 *
 * Note OT Weekly Inc is NOT an OTIncentiveSlab match — only the monthly
 * incentive is; there is no rule engine for the weekly one.
 *
 * None of this touches OT Hrs / OT Amount / OT Mon Incentive, which come
 * solely from computeEmployeeOtForMonth and fall back to zero, never to a
 * keyed-in figure.
 */

import { prisma } from '@/lib/prisma';
import { computeEmployeeOtForMonth, type OtPlanLike, type OtIncentiveSlabLike } from '@/lib/payroll/otCalculation';

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Which of the two possible sources an OC figure came from. */
export type OcSource = 'payroll' | 'manual' | 'none';

/**
 * Provenance for one cell, so a figure can be traced without reading code.
 *
 * Every value here is read back from the same computation that produced the
 * cell — nothing is re-derived for display. `computeEmployeeOtForMonth`
 * already returns the hourly rate, factors, caps and matched slab; the
 * register simply discarded them before.
 */
export interface CellExplain {
  /** Which table or function produced the value. */
  source: string;
  /** The calculation with this row's own numbers substituted in. */
  formula?: string;
  /** Anything that changes how the number should be read. */
  notes?: string[];
}

export type RowExplain = Record<string, CellExplain>;

export interface OtIncentiveRegisterRow {
  employeeId: number;
  slNo: number;
  employeeCode: string;
  employeeName: string;
  monthYearLabel: string;
  category: string | null;
  department: string | null;
  designation: string | null;
  dateOfJoining: string | null;
  gender: string | null;
  basic: number;

  otHours: number;
  /** OT Amount / OT Hrs — the effective hourly rate. Null when there are no OT hours. */
  otValue: number | null;
  otAmount: number;
  otMonthlyIncentive: number;
  otWeeklyIncentive: number;
  doubleMachineIncentive: number;
  attendanceBonus: number;
  shiftIncentive: number;
  employeeReferral: number;
  /** Always zero — "Extra Work" appears in the workbook's summary sheets with no per-employee source. */
  extraWork: number;
  /**
   * Petrol Allowance (PETROL component) and Performance Incentive
   * (PayrollLine.performanceIncentive). Both were columns on the previous
   * version of this report and are kept for parity. Neither appears in the
   * manual workbook, so neither is part of Tot OC Ear — including them would
   * break the verified Tot OC Ear formula.
   */
  petrolAllowance: number;
  performanceIncentive: number;

  totOcEarnings: number;
  ocEmployeeEsi: number;
  ocEmployerEsi: number;
  totOcNet: number;

  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  remarks: string;

  sources: { doubleMachineIncentive: OcSource; attendanceBonus: OcSource; shiftIncentive: OcSource };
  /** Per-cell provenance, keyed by the row field name. Display only. */
  explain: RowExplain;
  /** Recomputed OT disagrees with the amount stored on PayrollLine — the run is stale. */
  otStale: boolean;
  storedOtAmount: number | null;
}

export interface OtIncentiveRegisterTotals {
  otHours: number;
  otAmount: number;
  otMonthlyIncentive: number;
  otWeeklyIncentive: number;
  doubleMachineIncentive: number;
  attendanceBonus: number;
  shiftIncentive: number;
  employeeReferral: number;
  extraWork: number;
  petrolAllowance: number;
  performanceIncentive: number;
  totOcEarnings: number;
  ocEmployeeEsi: number;
  ocEmployerEsi: number;
  totOcNet: number;
}

export interface DepartmentSummaryRow {
  department: string;
  otHours: number;
  otAmount: number;
  /** The workbook's summary sheet labels this "Cumulative" — it is the MONTHLY OT incentive. */
  otMonthlyIncentive: number;
  /** The workbook labels this "Shift Cont" — it is OT WEEKLY incentive, not Shift Incentive. */
  otWeeklyIncentive: number;
  doubleMachineIncentive: number;
  attendanceBonus: number;
  extraWork: number;
  employeeReferral: number;
  shiftIncentive: number;
  totOcEarnings: number;
}

export interface OtIncentiveRegisterResult {
  run: { id: number; year: number; month: number; status: string } | null;
  rows: OtIncentiveRegisterRow[];
  totals: OtIncentiveRegisterTotals;
  departmentSummary: DepartmentSummaryRow[];
  /** Employees whose recomputed OT no longer matches the stored payroll line. */
  staleOtRows: number;
  /** Rows the Benefits module marked `hold` — their OC amounts are paid as zero. */
  heldRows: number;
  /** Rows present only in the Benefits module, with no payroll line this month. */
  offRunRows: number;
  esiRates: { employee: number; employer: number } | null;
}

const EMPTY_TOTALS = (): OtIncentiveRegisterTotals => ({
  otHours: 0, otAmount: 0, otMonthlyIncentive: 0, otWeeklyIncentive: 0,
  doubleMachineIncentive: 0, attendanceBonus: 0, shiftIncentive: 0,
  employeeReferral: 0, extraWork: 0, petrolAllowance: 0, performanceIncentive: 0,
  totOcEarnings: 0, ocEmployeeEsi: 0, ocEmployerEsi: 0, totOcNet: 0,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * RFC 4180 cell quoting. Embedded double-quotes are doubled — the previous
 * report wrapped values in quotes without escaping, so any employee name or
 * remark containing a `"` silently corrupted the rest of the CSV.
 */
export function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

/** Run `worker` over `items` with bounded concurrency, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    })
  );
  return results;
}

export interface RegisterFilters {
  /** Exact department name — the register's own rows are the source of the
   *  picker's options, so no masters-permission lookup is needed. */
  department?: string;
  /** Substring match on employee code or name. */
  search?: string;
}

export async function computeOtIncentiveRegister(
  companyId: number,
  year: number,
  month: number,
  filters: RegisterFilters = {}
): Promise<OtIncentiveRegisterResult> {
  const run = await prisma.payrollRun.findFirst({ where: { companyId, year, month } });
  if (!run) {
    return {
      run: null, rows: [], totals: EMPTY_TOTALS(), departmentSummary: [],
      staleOtRows: 0, heldRows: 0, offRunRows: 0, esiRates: null,
    };
  }

  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: run.id },
    select: {
      employeeId: true,
      otAmount: true,
      grossEarnings: true,
      performanceIncentive: true,
      components: {
        where: { salaryComponent: { code: { in: ['DM_INCENTIVE', 'ATT_BONUS', 'SHIFT_BONUS', 'PETROL'] } } },
        select: { amount: true, salaryComponent: { select: { code: true } } },
      },
    },
  });
  // The Benefits module covers every active employee, not just those on the
  // run, so it is queried company-wide and its employees are unioned in.
  // Without this, an incentive HR keyed for someone with no payroll line this
  // month would vanish from the register with no trace.
  const manualEntries = await prisma.doubleMachineIncentive.findMany({
    where: { companyId, year, month },
  });

  const lineEmpIds = new Set(lines.map((l) => l.employeeId));
  // Employees pulled in from the module alone must still be active — the
  // Benefits screen itself only lists active, non-deleted staff, so the
  // register should not resurrect a leaver on the strength of an old entry.
  const moduleOnlyIds = [...new Set(manualEntries.map((m) => m.employeeId))].filter((id) => !lineEmpIds.has(id));
  const activeModuleOnly = moduleOnlyIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: moduleOnlyIds }, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      })
    : [];
  const allEmpIds = [...lineEmpIds, ...activeModuleOnly.map((e) => e.id)];
  if (allEmpIds.length === 0) {
    return {
      run: { id: run.id, year: run.year, month: run.month, status: run.status },
      rows: [], totals: EMPTY_TOTALS(), departmentSummary: [],
      staleOtRows: 0, heldRows: 0, offRunRows: 0, esiRates: null,
    };
  }

  const employees = await prisma.employee.findMany({
    where: {
      id: { in: allEmpIds },
      ...(filters.department ? { jobInfos: { some: { effectiveTo: null, department: { name: filters.department } } } } : {}),
      ...(filters.search
        ? { OR: [{ employeeCode: { contains: filters.search } }, { firstName: { contains: filters.search } }, { lastName: { contains: filters.search } }] }
        : {}),
    },
    select: {
      id: true,
      employeeCode: true,
      oldEmployeeCode: true,
      firstName: true,
      lastName: true,
      personalDetails: { select: { gender: true } },
      bankDetail: { select: { accountNumber: true, ifscCode: true, bankName: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          esiApplicable: true,
          overtimeAllowed: true,
          overtimeFactor: true,
          overtimeRatePerHour: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      salaryRevisions: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          grossSalary: true,
          components: { select: { amount: true, salaryComponent: { select: { code: true, type: true } } } },
        },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  const [otPlans, otIncentiveSlabs, esiRate, summaries] = await Promise.all([
    prisma.oTPlan.findMany({ where: { isActive: true, deletedAt: null } }),
    prisma.oTIncentiveSlab.findMany({ where: { companyId, isActive: true, effectiveTo: null } }),
    prisma.esiRate.findFirst({ where: { effectiveTo: null, isActive: true } }),
    prisma.monthlyAttendanceSummary.findMany({
      where: { employeeId: { in: allEmpIds }, year, month },
      select: { employeeId: true, payableDays: true, lopDays: true, totalWorkingDays: true, status: true },
    }),
  ]);

  const lineByEmp = new Map(lines.map((l) => [l.employeeId, l]));
  const manualByEmp = new Map(manualEntries.map((m) => [m.employeeId, m]));
  const summaryByEmp = new Map(summaries.map((s) => [s.employeeId, s]));
  const totalWorkingDaysInMonth = daysInMonth(year, month);
  const monthYearLabel = `${MONTH_ABBR[month]}-${String(year).slice(-2)}`;

  const otResults = await mapLimit(employees, 12, async (emp) => {
    const revision = emp.salaryRevisions[0];
    const jobInfo = emp.jobInfos[0];
    if (!revision) return null;
    // Not on this payroll run — no OT is payable, so none is computed.
    if (!lineEmpIds.has(emp.id)) return null;

    // Same lopFactor derivation calculatePayrollRun uses, so the OT hourly
    // rate resolves identically.
    const summary = summaryByEmp.get(emp.id);
    if (!summary || summary.status === 'OPEN') return null;
    const payableDays = Number(summary.payableDays ?? (summary.totalWorkingDays - Number(summary.lopDays)));
    const totalDays = summary.totalWorkingDays > 0 ? summary.totalWorkingDays : totalWorkingDaysInMonth;
    const lopFactor = totalDays > 0 ? Math.min(1, Math.max(0, payableDays / totalDays)) : 0;

    return computeEmployeeOtForMonth({
      employeeId: emp.id,
      year,
      month,
      jobInfo,
      revision,
      lopFactor,
      totalWorkingDays: totalWorkingDaysInMonth,
      otPlans: otPlans as unknown as OtPlanLike[],
      otIncentiveSlabs: otIncentiveSlabs as unknown as OtIncentiveSlabLike[],
    });
  });

  const totals = EMPTY_TOTALS();
  let staleOtRows = 0;
  let heldRows = 0;
  let offRunRows = 0;

  const rows: OtIncentiveRegisterRow[] = employees.map((emp, i) => {
    const jobInfo = emp.jobInfos[0];
    const revision = emp.salaryRevisions[0];
    const line = lineByEmp.get(emp.id);
    const manual = manualByEmp.get(emp.id);
    const ot = otResults[i];

    const basic = (revision?.components ?? [])
      .filter((c) => c.salaryComponent.code === 'BASIC' && c.salaryComponent.type === 'earning')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const componentAmount = (code: string): number | null => {
      const matching = (line?.components ?? []).filter((c) => c.salaryComponent.code === code);
      if (matching.length === 0) return null;
      return matching.reduce((sum, c) => sum + Number(c.amount), 0);
    };

    // `hold` is the only status in the Benefits module that carries real
    // intent — it is the one "stop" affordance on that screen. `complete` is
    // not an approval (the Excel importer stamps it on every row, and a POST
    // omitting status defaults to it) and `draft` only ever means "all
    // amounts zero", so neither is treated as a gate. A held row pays zero
    // across every module-sourced column; the amounts stay visible in the
    // Benefits module itself.
    const onHold = manual?.status === 'hold';
    if (onHold) heldRows++;
    const moduleAmount = (value: unknown) => (onHold ? 0 : Number(value ?? 0));

    // Payroll now pays these from the Benefits module itself (only `complete`
    // rows — see payrollCalculation.ts), so the PayrollLineComponent it wrote
    // is the authoritative "what was actually paid" figure and wins. The
    // module value is the fallback, which is what shows for a period with no
    // payroll run yet, or for a row still sitting in `process`: keyed, real,
    // but not yet on a payslip.
    const pick = (code: string, moduleValue: number): { value: number; source: OcSource } => {
      // A held row pays nothing on either side — the hold is a decision about
      // the employee, not about one source.
      if (onHold) return { value: 0, source: 'manual' };
      const payrollValue = componentAmount(code);
      if (payrollValue !== null) return { value: payrollValue, source: 'payroll' };
      if (moduleValue > 0) return { value: moduleValue, source: 'manual' };
      return { value: 0, source: 'none' };
    };

    const dm = pick('DM_INCENTIVE', moduleAmount(manual?.doubleMachine));
    const att = pick('ATT_BONUS', moduleAmount(manual?.attendanceBonus));
    const shift = pick('SHIFT_BONUS', moduleAmount(manual?.shiftIncentive));

    const otHours = round2(ot?.totalOtHours ?? 0);
    const otAmount = ot?.otAmount ?? 0;
    const otMonthlyIncentive = ot?.otIncentiveAmount ?? 0;
    const otWeeklyIncentive = moduleAmount(manual?.otWeeklyInc);
    const employeeReferral = moduleAmount(manual?.employeeR);
    const extraWork = 0;
    // Carried over from the previous version of this report. Payroll-only
    // sources — there is no manual-register equivalent for either.
    const petrolAllowance = componentAmount('PETROL') ?? 0;
    const performanceIncentive = line ? Number(line.performanceIncentive) : 0;

    const totOcEarnings = round2(
      otAmount + otMonthlyIncentive + otWeeklyIncentive + dm.value + att.value + shift.value + employeeReferral
    );

    // ESI on the over-and-above earnings, gated exactly as the Performance
    // Incentive report gates it (JobInfo.esiApplicable + wage ceiling).
    const esiApplicable = jobInfo?.esiApplicable ?? false;
    const esiCeiling = esiRate ? Number(esiRate.wageCeilingMonthly) : null;
    const structuredGross = Number(revision?.grossSalary ?? 0);
    const monthGross = line ? Number(line.grossEarnings) : undefined;
    let esiEligible = false;
    if (esiApplicable && esiRate && esiCeiling !== null) {
      if (structuredGross > 0 && structuredGross <= esiCeiling) esiEligible = true;
      else if (monthGross !== undefined && monthGross <= esiCeiling) esiEligible = true;
    }
    const ocEmployeeEsi = esiEligible && esiRate ? round2(totOcEarnings * (Number(esiRate.employeeContributionRate) / 100)) : 0;
    const ocEmployerEsi = esiEligible && esiRate ? round2(totOcEarnings * (Number(esiRate.employerContributionRate) / 100)) : 0;
    const totOcNet = round2(totOcEarnings - ocEmployeeEsi);

    const storedOtAmount = line ? Number(line.otAmount) : null;
    const otStale = storedOtAmount !== null && storedOtAmount !== otAmount;
    if (otStale) staleOtRows++;

    const offRun = !lineEmpIds.has(emp.id);
    if (offRun) offRunRows++;

    let remarks = manual?.status ? manual.status.toUpperCase() : '';
    if (offRun) remarks = remarks ? `${remarks} · NO PAYROLL LINE` : 'NO PAYROLL LINE';
    else if (!revision) remarks = 'NO SALARY STRUCTURE';
    else if (!summaryByEmp.get(emp.id)) remarks = 'NO ATTENDANCE';
    else if (otStale) remarks = remarks ? `${remarks} · STALE` : 'STALE';

    // ── Per-cell provenance ────────────────────────────────────────────
    // Read back from the values above and from computeEmployeeOtForMonth's
    // own return — nothing is recalculated here. Where a figure is a running
    // sum rather than one expression (OT Amount), the structure is described
    // honestly instead of being flattened into a formula it does not follow.
    const money = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const OT_FN = 'computeEmployeeOtForMonth() — the same function calculatePayrollRun uses';
    const ocSourceText = (src: OcSource, code: string) =>
      src === 'payroll'
        ? `PayrollLineComponent "${code}" — written by payroll for this run`
        : src === 'manual'
          ? `Workforce › Benefits › Double Machine Incentive (DoubleMachineIncentive table) — keyed by HR. Payroll wrote no "${code}" component for this employee, so the keyed figure is shown.`
          : `No value from either source (no payroll component and no Benefits entry).`;

    const explain: RowExplain = {
      otHours: {
        source: OT_FN,
        formula: ot
          ? `${ot.days.length} payable OT day(s) → ${round2(ot.uncappedOtHours)} h before caps → ${otHours} h after the OTPlan caps`
          : 'No OT computed — employee not OT-eligible, or no finalized attendance for the period.',
        notes: ot ? [
          'Only days with status Present / HalfDay / OnDuty and either approved-as-OT or no approval decision are counted.',
          `Per-day threshold, rounding slab and daily cap applied via computeOtPayableMinutes; plan "${ot.otPlan?.code ?? '—'}".`,
          ...(round2(ot.uncappedOtHours) !== otHours ? ['A weekly or monthly cap reduced these hours.'] : []),
        ] : undefined,
      },
      otValue: {
        source: 'Derived for display only — not stored anywhere.',
        formula: otHours > 0
          ? `OT Value = OT Amount ÷ OT Hrs = ${money(otAmount)} ÷ ${otHours} = ${money(round2(otAmount / otHours))}`
          : 'Blank — no OT hours to divide by.',
      },
      otAmount: {
        source: OT_FN,
        formula: ot && ot.days.length
          ? `Σ over ${ot.days.length} day(s) of (day hours × ${money(ot.otHourlyRate)} hourly × day factor), then weekly/monthly caps${ot.matchedSlab && ot.matchedSlab.flatBonusAmount == null ? `, then × ${Number(ot.matchedSlab.incentiveMultiplier)} slab multiplier` : ''} → ${money(otAmount)}`
          : `${money(otAmount)}`,
        notes: ot ? [
          `Hourly rate basis: ${ot.otBasis} (÷ working days ÷ 8).`,
          `Base factor ${ot.baseFactor}, then the day-type factor — weekday / weekly-off / holiday — per day.`,
          'Not a single multiplication: each day is priced separately before the caps apply.',
        ] : undefined,
      },
      otMonthlyIncentive: {
        source: ot?.matchedSlab
          ? `OTIncentiveSlab "${ot.matchedSlab.code ?? '—'}" matched on the POST-cap OT hours`
          : 'OTIncentiveSlab — no band matched this month',
        formula: ot?.matchedSlab
          ? `${otHours} h falls in slab ${ot.matchedSlab.code ?? ''} [${Number(ot.matchedSlab.minOtHours)} – ${ot.matchedSlab.maxOtHours === null ? '∞' : Number(ot.matchedSlab.maxOtHours)}) → flat ${money(otMonthlyIncentive)}`
          : `${otHours} h matched no slab band → ${money(0)}`,
        notes: ['Matched on capped hours, the same figure payroll paid on — not on raw attendance minutes.'],
      },
      otWeeklyIncentive: {
        source: 'Workforce › Benefits › Double Machine Incentive (DoubleMachineIncentive.otWeeklyInc) — keyed by HR.',
        notes: [
          'There is no rule engine for this. It is NOT an OTIncentiveSlab match — only the monthly incentive is.',
          'The workbook documents the intent as Mon–Sat OT ≥ 4h → ₹500/week, but nothing computes it.',
        ],
      },
      employeeReferral: {
        source: 'Workforce › Benefits › Double Machine Incentive (DoubleMachineIncentive.employeeR) — keyed by HR.',
        notes: ['No payroll-computed counterpart exists; the Benefits entry is the only source.'],
      },
      doubleMachineIncentive: { source: ocSourceText(dm.source, 'DM_INCENTIVE') },
      attendanceBonus: { source: ocSourceText(att.source, 'ATT_BONUS') },
      shiftIncentive: { source: ocSourceText(shift.source, 'SHIFT_BONUS') },
      petrolAllowance: {
        source: 'PayrollLineComponent "PETROL" — payroll sums approved PetrolAllowanceEntry rows.',
        notes: ['Not part of Tot OC Ear — it has no counterpart in the manual workbook.'],
      },
      performanceIncentive: {
        source: 'PayrollLine.performanceIncentive — from the PMS module (approved/finalized rows only).',
        notes: [
          'Not part of Tot OC Ear.',
          'The standalone Performance Incentive report recomputes this from CTC × present days × PMS %, so the two can differ.',
        ],
      },
      totOcEarnings: {
        source: 'Sum of this row — matches the manual workbook\'s own formula.',
        formula: `${money(otAmount)} OT + ${money(otMonthlyIncentive)} OT Mon + ${money(otWeeklyIncentive)} OT Weekly + ${money(dm.value)} DM + ${money(att.value)} ATT + ${money(shift.value)} Shift + ${money(employeeReferral)} Referral = ${money(totOcEarnings)}`,
        notes: ['Petrol Allowance and Performance Incentive are deliberately excluded — the workbook does not include them.'],
      },
      ocEmployeeEsi: {
        source: esiRate ? 'EsiRate (effective, active) applied to Tot OC Ear' : 'No active EsiRate configured',
        formula: esiEligible && esiRate
          ? `${money(totOcEarnings)} × ${Number(esiRate.employeeContributionRate)}% = ${money(ocEmployeeEsi)}`
          : `Not ESI-covered this month → ${money(0)}`,
        notes: [
          `JobInfo.esiApplicable = ${esiApplicable}`,
          esiCeiling !== null ? `Wage ceiling ${money(esiCeiling)}; structured gross ${money(structuredGross)}${monthGross !== undefined ? `, month gross ${money(monthGross)}` : ''}` : 'No wage ceiling configured',
          `Covered: ${esiEligible ? 'yes' : 'no'} — eligible if structured gross or month gross is at or under the ceiling.`,
        ],
      },
      ocEmployerEsi: {
        source: esiRate ? 'EsiRate (effective, active) applied to Tot OC Ear' : 'No active EsiRate configured',
        formula: esiEligible && esiRate
          ? `${money(totOcEarnings)} × ${Number(esiRate.employerContributionRate)}% = ${money(ocEmployerEsi)}`
          : `Not ESI-covered this month → ${money(0)}`,
        notes: ['Employer-side cost — informational, never deducted from the employee.'],
      },
      totOcNet: {
        source: 'Derived from this row.',
        formula: `Tot OC Ear ${money(totOcEarnings)} − OC Empl ESI ${money(ocEmployeeEsi)} = ${money(totOcNet)}`,
        notes: ['Employer ESI is not subtracted — it is not the employee\'s money.'],
      },
    };

    totals.otHours += otHours;
    totals.otAmount += otAmount;
    totals.otMonthlyIncentive += otMonthlyIncentive;
    totals.otWeeklyIncentive += otWeeklyIncentive;
    totals.doubleMachineIncentive += dm.value;
    totals.attendanceBonus += att.value;
    totals.shiftIncentive += shift.value;
    totals.employeeReferral += employeeReferral;
    totals.extraWork += extraWork;
    totals.petrolAllowance += petrolAllowance;
    totals.performanceIncentive += performanceIncentive;
    totals.totOcEarnings += totOcEarnings;
    totals.ocEmployeeEsi += ocEmployeeEsi;
    totals.ocEmployerEsi += ocEmployerEsi;
    totals.totOcNet += totOcNet;

    return {
      employeeId: emp.id,
      slNo: i + 1,
      // Same rule as the Double Machine Incentive module's displayCode() and
      // the manual workbook's "Emp ID" column (17, 173, 216…): the legacy
      // code wins when the employee has one.
      employeeCode: emp.oldEmployeeCode?.trim() || emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName ?? ''}`.trim(),
      monthYearLabel,
      category: jobInfo?.category?.name ?? null,
      department: jobInfo?.department?.name ?? null,
      designation: jobInfo?.designation?.name ?? null,
      dateOfJoining: jobInfo?.joinDate ? jobInfo.joinDate.toISOString().slice(0, 10) : null,
      gender: emp.personalDetails?.gender ?? null,
      basic: round2(basic),
      otHours,
      otValue: otHours > 0 ? round2(otAmount / otHours) : null,
      otAmount,
      otMonthlyIncentive,
      otWeeklyIncentive,
      doubleMachineIncentive: dm.value,
      attendanceBonus: att.value,
      shiftIncentive: shift.value,
      employeeReferral,
      extraWork,
      petrolAllowance,
      performanceIncentive,
      totOcEarnings,
      ocEmployeeEsi,
      ocEmployerEsi,
      totOcNet,
      bankAccountNumber: emp.bankDetail?.accountNumber ?? null,
      bankIfsc: emp.bankDetail?.ifscCode ?? null,
      bankName: emp.bankDetail?.bankName ?? null,
      remarks,
      sources: { doubleMachineIncentive: dm.source, attendanceBonus: att.source, shiftIncentive: shift.source },
      explain,
      otStale,
      storedOtAmount,
    };
  });

  for (const k of Object.keys(totals) as (keyof OtIncentiveRegisterTotals)[]) totals[k] = round2(totals[k]);

  // Department summary is derived from the rows above rather than queried
  // separately, so the two views can never disagree.
  const byDept = new Map<string, DepartmentSummaryRow>();
  for (const r of rows) {
    const key = r.department ?? '—';
    const d = byDept.get(key) ?? {
      department: key, otHours: 0, otAmount: 0, otMonthlyIncentive: 0, otWeeklyIncentive: 0,
      doubleMachineIncentive: 0, attendanceBonus: 0, extraWork: 0, employeeReferral: 0,
      shiftIncentive: 0, totOcEarnings: 0,
    };
    d.otHours += r.otHours;
    d.otAmount += r.otAmount;
    d.otMonthlyIncentive += r.otMonthlyIncentive;
    d.otWeeklyIncentive += r.otWeeklyIncentive;
    d.doubleMachineIncentive += r.doubleMachineIncentive;
    d.attendanceBonus += r.attendanceBonus;
    d.extraWork += r.extraWork;
    d.employeeReferral += r.employeeReferral;
    d.shiftIncentive += r.shiftIncentive;
    d.totOcEarnings += r.totOcEarnings;
    byDept.set(key, d);
  }
  const departmentSummary = [...byDept.values()]
    .map((d) => ({
      ...d,
      otHours: round2(d.otHours), otAmount: round2(d.otAmount),
      otMonthlyIncentive: round2(d.otMonthlyIncentive), otWeeklyIncentive: round2(d.otWeeklyIncentive),
      doubleMachineIncentive: round2(d.doubleMachineIncentive), attendanceBonus: round2(d.attendanceBonus),
      extraWork: round2(d.extraWork), employeeReferral: round2(d.employeeReferral),
      shiftIncentive: round2(d.shiftIncentive), totOcEarnings: round2(d.totOcEarnings),
    }))
    .sort((a, b) => a.department.localeCompare(b.department));

  return {
    run: { id: run.id, year: run.year, month: run.month, status: run.status },
    rows,
    totals,
    departmentSummary,
    staleOtRows,
    heldRows,
    offRunRows,
    esiRates: esiRate
      ? { employee: Number(esiRate.employeeContributionRate), employer: Number(esiRate.employerContributionRate) }
      : null,
  };
}

// ── Month-over-month trend ──────────────────────────────────────────────

/** Row labels match the workbook's comparison sheet, in its order. */
export const TREND_CATEGORIES = [
  'Monthly OT Amount',
  'Shift Continuation OT incentive',
  'Cumulative OT Hour incentives',
  'Double Machine incentives',
  'Attendance Bonus',
  'Employee referral bonus',
  'Extra Work incentives',
  'Total Amount',
  'LOP Salary Recovered',
] as const;

export interface TrendPeriod { year: number; month: number; label: string; hasRun: boolean }
export interface TrendRow { category: string; values: (number | null)[] }

export interface OtIncentiveTrendResult {
  periods: TrendPeriod[];
  rows: TrendRow[];
}

/**
 * Trailing `count` months ending at (year, month), newest first — the same
 * orientation as the workbook's comparison sheet.
 *
 * "LOP Salary Recovered" is the workbook's Gross Salary − Salary Earned
 * (verified: 15,835,490 − 15,009,568 = 825,922 for Feb'26), i.e. the salary
 * withheld for unpaid days — computed here as the structured gross of every
 * employee on the run minus the LOP-adjusted gross payroll actually earned.
 * It is not part of "Total Amount", which is the OC earnings total.
 */
export async function computeOtIncentiveTrend(
  companyId: number,
  year: number,
  month: number,
  count = 12
): Promise<OtIncentiveTrendResult> {
  const periods: TrendPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    periods.push({ year: y, month: m, label: `${MONTH_ABBR[m]}'${String(y).slice(-2)}`, hasRun: false });
  }

  const columns = await Promise.all(
    periods.map(async (p) => {
      const result = await computeOtIncentiveRegister(companyId, p.year, p.month);
      if (!result.run) return null;
      p.hasRun = true;

      // LOP Salary Recovered — structured gross vs earned gross on this run.
      const lines = await prisma.payrollLine.findMany({
        where: { payrollRunId: result.run.id },
        select: {
          grossEarnings: true,
          employee: { select: { salaryRevisions: { where: { effectiveTo: null }, take: 1, select: { grossSalary: true } } } },
        },
      });
      let structuredGross = 0;
      let earnedGross = 0;
      for (const l of lines) {
        structuredGross += Number(l.employee.salaryRevisions[0]?.grossSalary ?? 0);
        earnedGross += Number(l.grossEarnings);
      }

      const t = result.totals;
      return {
        'Monthly OT Amount': t.otAmount,
        'Shift Continuation OT incentive': t.otWeeklyIncentive,
        'Cumulative OT Hour incentives': t.otMonthlyIncentive,
        'Double Machine incentives': t.doubleMachineIncentive,
        'Attendance Bonus': t.attendanceBonus,
        'Employee referral bonus': t.employeeReferral,
        'Extra Work incentives': t.extraWork,
        'Total Amount': t.totOcEarnings,
        'LOP Salary Recovered': round2(Math.max(0, structuredGross - earnedGross)),
      } as Record<string, number>;
    })
  );

  const rows: TrendRow[] = TREND_CATEGORIES.map((category) => ({
    category,
    values: columns.map((c) => (c ? c[category] : null)),
  }));

  return { periods, rows };
}
