/**
 * Model A weightage validation — BRD §17 "Weightage Rule" and §41.
 *
 *   Total KRA weightage across a goal set (or template) = 100%
 *   Total KPI weightage *within each KRA*               = 100%
 *
 * The BRD offers Model B (KPI weights summing to the KRA's share) as the
 * alternative; Model A is the one it recommends and the only one implemented.
 *
 * Shared by the template builder and goal assignment on purpose: a template
 * can be a valid 100/100 set, but an HR user who then customises one
 * employee's split must hit exactly the same wall.
 */

/** Weightages are DECIMAL(5,2), so compare at 2dp rather than exactly. */
const TOLERANCE = 0.01;

export type WeightageKra = {
  /** For error messages — KRA code or name. */
  label: string;
  weightage: number;
  kpis: Array<{ label: string; weightage: number }>;
};

export type WeightageResult = {
  valid: boolean;
  errors: string[];
  kraTotal: number;
  /** KPI total per KRA, keyed by the KRA's label — drives the live UI totals. */
  kpiTotals: Record<string, number>;
};

function sum(values: number[]): number {
  return Number(values.reduce((a, b) => a + b, 0).toFixed(2));
}

export function validateWeightages(kras: WeightageKra[]): WeightageResult {
  const errors: string[] = [];
  const kpiTotals: Record<string, number> = {};

  if (kras.length === 0) {
    errors.push('At least one KRA is required');
  }

  const kraTotal = sum(kras.map((k) => k.weightage));
  if (kras.length > 0 && Math.abs(kraTotal - 100) > TOLERANCE) {
    errors.push(`Total KRA weightage must be 100% (currently ${kraTotal}%)`);
  }

  for (const kra of kras) {
    if (kra.weightage <= 0) {
      errors.push(`KRA "${kra.label}" must have a weightage greater than 0`);
    }
    if (kra.kpis.length === 0) {
      errors.push(`KRA "${kra.label}" has no KPIs`);
      kpiTotals[kra.label] = 0;
      continue;
    }
    const total = sum(kra.kpis.map((k) => k.weightage));
    kpiTotals[kra.label] = total;
    if (Math.abs(total - 100) > TOLERANCE) {
      errors.push(`KPI weightage within KRA "${kra.label}" must be 100% (currently ${total}%)`);
    }
    for (const kpi of kra.kpis) {
      if (kpi.weightage <= 0) {
        errors.push(`KPI "${kpi.label}" in KRA "${kra.label}" must have a weightage greater than 0`);
      }
    }
  }

  return { valid: errors.length === 0, errors, kraTotal, kpiTotals };
}

/**
 * BRD §41 date rule: a KPI's window must sit inside the cycle's window.
 * The BRD allows an override ("unless explicitly allowing exceptions") but no
 * such config exists anywhere in this system yet, so this is enforced hard.
 * When that config lands, it belongs here as a parameter — not as a bypass at
 * the call site.
 */
export function validateKpiDates(
  kpis: Array<{ label: string; startDate: Date; endDate: Date }>,
  cycle: { startDate: Date; endDate: Date }
): string[] {
  const errors: string[] = [];
  for (const kpi of kpis) {
    if (kpi.endDate < kpi.startDate) {
      errors.push(`KPI "${kpi.label}": end date is before start date`);
      continue;
    }
    if (kpi.startDate < cycle.startDate) {
      errors.push(`KPI "${kpi.label}": start date is before the cycle start date`);
    }
    if (kpi.endDate > cycle.endDate) {
      errors.push(`KPI "${kpi.label}": end date is after the cycle end date`);
    }
  }
  return errors;
}
