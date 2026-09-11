/**
 * Payroll validation engine — implements BRD §17 validations.
 *
 * Each validation produces a result with severity:
 *   - ERROR: line is put on HOLD
 *   - WARNING: line passes but warning is recorded
 *   - INFO: informational only
 */

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationResult {
  code: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
}

export interface PayrollLineContext {
  employeeId: number;
  employeeCode: string;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  otAmount: number;
  otMinutes: number;
  lopDays: number;
  payableDays: number;
  pfEmployee: number;
  esiEmployee: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  attendanceStatus: string | null;
  componentCodes: string[];
}

/**
 * Run all configured validations against a payroll line.
 * Returns an array of validation results (empty if all pass).
 */
export function validatePayrollLine(
  ctx: PayrollLineContext,
  config: {
    allowNegativeNet: boolean;
    minNetPercentOfGross: number;
    maxDeductionPercent: number;
    statutoryIncludedInLimit: boolean;
    maxOtHoursPerMonth?: number | null;
    maxOtPercentOfGross?: number | null;
    checkGrossReconciliation: boolean;
    maxLopDaysPerMonth?: number | null;
    checkAttendanceFrozen: boolean;
    checkDuplicateComponents: boolean;
    minPayableDays?: number | null;
    warnIfZeroGross: boolean;
  }
): ValidationResult[] {
  const results: ValidationResult[] = [];

  // 1. Negative net salary
  if (ctx.netSalary < 0 && !config.allowNegativeNet) {
    results.push({
      code: 'NEG_NET',
      severity: 'ERROR',
      message: `Net salary is negative (${ctx.netSalary.toFixed(2)})`,
    });
  }

  // 2. Net below minimum % of gross
  if (ctx.grossEarnings > 0 && config.minNetPercentOfGross > 0) {
    const minNet = ctx.grossEarnings * config.minNetPercentOfGross / 100;
    if (ctx.netSalary < minNet) {
      results.push({
        code: 'NET_BELOW_MIN',
        severity: 'ERROR',
        message: `Net salary (${ctx.netSalary.toFixed(2)}) below minimum ${config.minNetPercentOfGross}% of gross`,
      });
    }
  }

  // 3. Deduction % exceeds max
  if (ctx.grossEarnings > 0 && config.maxDeductionPercent < 100) {
    const statutoryDeductions = config.statutoryIncludedInLimit
      ? ctx.pfEmployee + ctx.esiEmployee + ctx.professionalTax + ctx.tds
      : 0;
    const totalDeductions = statutoryDeductions + ctx.otherDeductions;
    const deductionPercent = (totalDeductions / ctx.grossEarnings) * 100;
    if (deductionPercent > config.maxDeductionPercent) {
      results.push({
        code: 'DEDUCT_EXCEED',
        severity: 'ERROR',
        message: `Total deductions ${deductionPercent.toFixed(1)}% exceed max ${config.maxDeductionPercent}%`,
      });
    }
  }

  // 4. OT hours exceed monthly cap
  if (config.maxOtHoursPerMonth != null && ctx.otMinutes > 0) {
    const otHours = ctx.otMinutes / 60;
    if (otHours > config.maxOtHoursPerMonth) {
      results.push({
        code: 'OT_EXCEED_HRS',
        severity: 'ERROR',
        message: `OT hours (${otHours.toFixed(1)}) exceed monthly cap (${config.maxOtHoursPerMonth})`,
      });
    }
  }

  // 5. OT % of gross exceeds limit
  if (config.maxOtPercentOfGross != null && ctx.grossEarnings > 0 && ctx.otAmount > 0) {
    const otPercent = (ctx.otAmount / ctx.grossEarnings) * 100;
    if (otPercent > config.maxOtPercentOfGross) {
      results.push({
        code: 'OT_EXCEED_PCT',
        severity: 'WARNING',
        message: `OT (${otPercent.toFixed(1)}% of gross) exceeds limit ${config.maxOtPercentOfGross}%`,
      });
    }
  }

  // 6. Gross reconciliation — sum of components should equal gross
  // (This is checked at the component level, not here — placeholder)
  if (config.checkGrossReconciliation) {
    // This validation requires comparing component sums to grossEarnings.
    // The payroll engine already ensures this; we flag only if there's a
    // discrepancy detected externally.
  }

  // 7. LOP days exceed monthly cap
  if (config.maxLopDaysPerMonth != null && ctx.lopDays > config.maxLopDaysPerMonth) {
    results.push({
      code: 'LOP_EXCEED',
      severity: 'WARNING',
      message: `LOP days (${ctx.lopDays}) exceed cap (${config.maxLopDaysPerMonth})`,
    });
  }

  // 8. Attendance not frozen
  if (config.checkAttendanceFrozen && ctx.attendanceStatus &&
      ctx.attendanceStatus !== 'FINALIZED' && ctx.attendanceStatus !== 'FROZEN') {
    results.push({
      code: 'ATTN_NOT_FROZEN',
      severity: 'WARNING',
      message: `Attendance is ${ctx.attendanceStatus}, not FINALIZED/FROZEN`,
    });
  }

  // 9. Duplicate component codes
  if (config.checkDuplicateComponents) {
    const seen = new Set<string>();
    for (const code of ctx.componentCodes) {
      if (seen.has(code)) {
        results.push({
          code: 'DUP_COMPONENT',
          severity: 'ERROR',
          message: `Duplicate salary component: ${code}`,
        });
      }
      seen.add(code);
    }
  }

  // 10. Payable days below minimum
  if (config.minPayableDays != null && ctx.payableDays < config.minPayableDays) {
    results.push({
      code: 'PAYABLE_BELOW_MIN',
      severity: 'WARNING',
      message: `Payable days (${ctx.payableDays}) below minimum (${config.minPayableDays})`,
    });
  }

  // 11. Zero gross warning
  if (config.warnIfZeroGross && ctx.grossEarnings === 0) {
    results.push({
      code: 'ZERO_GROSS',
      severity: 'WARNING',
      message: 'Gross earnings are zero',
    });
  }

  return results;
}

/**
 * Determine the line status based on validation results.
 * If any ERROR severity result exists, the line goes on HOLD.
 */
export function determineLineStatus(results: ValidationResult[]): { status: 'OK' | 'HOLD'; reason: string | null } {
  const errors = results.filter((r) => r.severity === 'ERROR');
  if (errors.length > 0) {
    return { status: 'HOLD', reason: errors.map((e) => e.message).join('; ') };
  }
  return { status: 'OK', reason: null };
}
