/**
 * KPI measurement types — BRD §10 "KPI Measurement Methods".
 *
 * Achievement formulas live here as a strategy per measurement type, never
 * hard-coded at the call site, so adding a method (or changing how one is
 * capped) is a change in one place.
 *
 * Nothing in the goal-assignment scope *calls* achievement() yet — assessment
 * is a later phase (BRD §18-§22). What assignment needs today is the type
 * list, the per-type validation rules, and the labels. The formulas are here
 * so the assessment work inherits them rather than reinventing them.
 */

export const MEASUREMENT_TYPES = ['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'RATING_1_5'] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export const MEASUREMENT_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'] as const;
export type MeasurementFrequency = (typeof MEASUREMENT_FREQUENCIES)[number];

/**
 * BRD §23 achievement capping. The BRD recommends 0-120% but insists it stay
 * configurable, so strategies take the bounds rather than owning them.
 */
export type AchievementCaps = {
  minAchievementPct: number;
  maxAchievementPct: number;
};

export const DEFAULT_CAPS: AchievementCaps = { minAchievementPct: 0, maxAchievementPct: 120 };

export type MeasurementStrategy = {
  value: MeasurementType;
  label: string;
  /** Unit is meaningless for a rating scale — the UI fixes it to "Rating". */
  fixedUnit?: string;
  /** Targets outside this range are rejected at the API layer. */
  targetRange?: { min: number; max: number };
  /** Achievement % from a target/actual pair, before capping. */
  rawAchievementPct: (target: number, actual: number) => number | null;
};

const STRATEGIES: Record<MeasurementType, MeasurementStrategy> = {
  // BRD §10 Method 1 — Achievement % = Actual / Target × 100.
  HIGHER_IS_BETTER: {
    value: 'HIGHER_IS_BETTER',
    label: 'Achievement % — higher is better',
    rawAchievementPct: (target, actual) => (target === 0 ? null : (actual / target) * 100),
  },
  // BRD §10 Method 2 — inverted, for metrics like resolution time or defect rate.
  LOWER_IS_BETTER: {
    value: 'LOWER_IS_BETTER',
    label: 'Achievement % — lower is better',
    rawAchievementPct: (target, actual) => (actual === 0 ? null : (target / actual) * 100),
  },
  // BRD §10 Method 3 — a 1-5 scale, where the "target" is the rating to hit.
  RATING_1_5: {
    value: 'RATING_1_5',
    label: 'Rating based (1-5)',
    fixedUnit: 'Rating',
    targetRange: { min: 1, max: 5 },
    rawAchievementPct: (target, actual) => (target === 0 ? null : (actual / target) * 100),
  },
};

export function getStrategy(type: MeasurementType): MeasurementStrategy {
  return STRATEGIES[type];
}

export function isMeasurementType(value: string): value is MeasurementType {
  return (MEASUREMENT_TYPES as readonly string[]).includes(value);
}

/** Capped achievement %, the number an assessment will actually score against. */
export function achievementPct(
  type: MeasurementType,
  target: number,
  actual: number,
  caps: AchievementCaps = DEFAULT_CAPS
): number | null {
  const raw = getStrategy(type).rawAchievementPct(target, actual);
  if (raw == null || !Number.isFinite(raw)) return null;
  const capped = Math.min(Math.max(raw, caps.minAchievementPct), caps.maxAchievementPct);
  return Number(capped.toFixed(2));
}

/** The optional floor/ceiling a KPI can carry alongside its target. */
export type TargetBounds = {
  minThreshold?: number | null;
  maxTarget?: number | null;
};

/**
 * Per-type target validation, shared by KPI master, template and goal
 * assignment so a rating KPI cannot be given a target of 250 anywhere.
 *
 * Also checks the target against its own thresholds when they are set. The
 * schema already rejects maxTarget < minThreshold, but nothing previously
 * stopped a target falling outside that band — min 80 / max 100 / target 150
 * saved happily and would have scored against a range it could never sit in.
 */
export function validateTargetForType(
  type: MeasurementType,
  target: number,
  bounds?: TargetBounds
): string | null {
  const strategy = getStrategy(type);
  if (!Number.isFinite(target)) return 'Target must be a number';
  if (strategy.targetRange) {
    const { min, max } = strategy.targetRange;
    if (target < min || target > max) {
      return `Target for "${strategy.label}" must be between ${min} and ${max}`;
    }
  } else if (target <= 0) {
    // Both achievement formulas divide by target or actual; a non-positive
    // target makes achievement undefined.
    return 'Target must be greater than 0';
  }

  const min = bounds?.minThreshold;
  const max = bounds?.maxTarget;
  if (min != null && Number.isFinite(min) && target < min) {
    return `Target (${target}) cannot be below the minimum threshold (${min})`;
  }
  if (max != null && Number.isFinite(max) && target > max) {
    return `Target (${target}) cannot exceed the maximum target (${max})`;
  }
  return null;
}

export const MEASUREMENT_TYPE_OPTIONS = MEASUREMENT_TYPES.map((t) => ({
  value: t,
  label: STRATEGIES[t].label,
}));
