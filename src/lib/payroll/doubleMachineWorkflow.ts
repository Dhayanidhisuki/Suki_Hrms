/**
 * Status transitions for Workforce > Benefits > Double Machine Incentive.
 *
 * Status used to be decorative — a free field on the upsert, with the Excel
 * importer stamping every row `complete` and a POST omitting status defaulting
 * to `complete` too. Now that payrollCalculation pays `complete` rows, it is a
 * money control, so transitions run through these routes rather than through a
 * raw write.
 *
 * Same shape as the PMS module (api/payroll/pms/[id]/{approve,hold,return}) and
 * the F&F convention in src/lib/fnf/workflow.ts: a Set of legal source statuses
 * per verb, checked before the update. There is no shared transition engine in
 * this codebase to plug into — the platform workflow engine
 * (src/lib/platform/workflow) is fully built but has no business-module
 * adopters, so following the established convention keeps payroll on one idiom.
 *
 *   draft ─┐
 *   process├─ approve ─> complete ─ hold ───> hold
 *   hold ──┘                      └ return ─> process
 */

export const DM_STATUSES = ['draft', 'process', 'hold', 'complete'] as const;
export type DmStatus = (typeof DM_STATUSES)[number];

/** approve → complete. The only status payroll pays. */
export const CAN_APPROVE: ReadonlySet<DmStatus> = new Set(['draft', 'process', 'hold']);

/** hold → hold. The explicit "do not pay", honoured by payroll and the register. */
export const CAN_HOLD: ReadonlySet<DmStatus> = new Set(['draft', 'process', 'complete']);

/** return → process. Sends an approved or held row back for rework. */
export const CAN_RETURN: ReadonlySet<DmStatus> = new Set(['complete', 'hold']);

export type DmVerb = 'approve' | 'hold' | 'return';

const RULES: Record<DmVerb, { from: ReadonlySet<DmStatus>; to: DmStatus; activity: string }> = {
  approve: { from: CAN_APPROVE, to: 'complete', activity: 'double_machine_approved' },
  hold: { from: CAN_HOLD, to: 'hold', activity: 'double_machine_held' },
  return: { from: CAN_RETURN, to: 'process', activity: 'double_machine_returned' },
};

export interface TransitionPlan {
  to: DmStatus;
  activity: string;
}

/**
 * Validate a transition. Returns the plan, or an error message naming both the
 * current status and what would have been legal — a bare "invalid transition"
 * tells whoever hits it nothing.
 */
export function planTransition(verb: DmVerb, current: string): TransitionPlan | { error: string } {
  const rule = RULES[verb];
  if (!rule) return { error: `Unknown action "${verb}"` };
  if (current === rule.to) {
    return { error: `Already ${rule.to} — nothing to ${verb}` };
  }
  if (!rule.from.has(current as DmStatus)) {
    return {
      error: `Cannot ${verb} a row that is "${current}" — only ${[...rule.from].join(', ')} can be ${verb}d`,
    };
  }
  return { to: rule.to, activity: rule.activity };
}
