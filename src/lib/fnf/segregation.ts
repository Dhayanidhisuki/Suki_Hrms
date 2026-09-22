/**
 * Segregation of duties on the F&F approval chain.
 *
 * The rule is one sentence so it can be explained to an auditor: **no single
 * user may take two different approval-chain steps on the same settlement.**
 *
 * The chain is submit → manager-approve → HR approve → finance-verify →
 * mark-paid. `calculate` is deliberately NOT part of it: preparing the
 * settlement and submitting it are the same job, and payroll doing both is
 * the normal case, not a control failure.
 *
 * Enforcement is per company via FullAndFinalConfig.enforceSegregationOfDuties,
 * defaulting to on. A payroll team too small to separate the roles can switch
 * it off as a deliberate, recorded decision — which is very different from the
 * control never having existed.
 */

/** Approval-chain steps, in order. Excludes calculate; see above. */
export const FNF_CHAIN_STEPS = ['submit', 'manager-approve', 'approve', 'finance-verify', 'mark-paid'] as const;
export type FnfChainStep = (typeof FNF_CHAIN_STEPS)[number];

/**
 * Who each step records. Spelled out rather than indexed by string so a
 * renamed column fails the build instead of silently never matching — a
 * segregation check that quietly compares against `undefined` always passes,
 * which is the worst way for a control to fail.
 */
export type ChainActors = {
  submittedByUserId?: number | null;
  managerApprovedByUserId?: number | null;
  approvedByUserId?: number | null;
  financeVerifiedByUserId?: number | null;
  paidByUserId?: number | null;
};

const STEP_ACTOR: Record<FnfChainStep, { field: keyof ChainActors; label: string }> = {
  submit: { field: 'submittedByUserId', label: 'submitted' },
  'manager-approve': { field: 'managerApprovedByUserId', label: 'manager-approved' },
  approve: { field: 'approvedByUserId', label: 'HR-approved' },
  'finance-verify': { field: 'financeVerifiedByUserId', label: 'finance-verified' },
  'mark-paid': { field: 'paidByUserId', label: 'marked paid' },
};

/**
 * Returns an explanatory message when `userId` has already taken a different
 * step on this settlement, or null when the action may proceed.
 *
 * A user repeating the SAME step is not a segregation failure — that is a
 * retry, and the status guard already decides whether it is allowed.
 */
export function segregationConflict(
  settlement: ChainActors,
  userId: number | null | undefined,
  step: FnfChainStep,
  enforce: boolean,
): string | null {
  if (!enforce) return null;
  // An unidentified actor cannot be checked against anything. Routes reach
  // this only behind an authenticated permission check, so this is the
  // "header missing in a direct call" case rather than an anonymous caller.
  if (userId == null || !Number.isFinite(userId)) return null;

  for (const other of FNF_CHAIN_STEPS) {
    if (other === step) continue;
    const { field, label } = STEP_ACTOR[other];
    if (settlement[field] === userId) {
      return `Segregation of duties: you already ${label} this settlement, so it must be ${STEP_ACTOR[step].label} by someone else.`;
    }
  }
  return null;
}
