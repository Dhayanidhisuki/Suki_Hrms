/**
 * Level satisfaction (BRD §7.7). Pure, unit-tested.
 *
 * Slot model. One matrix line materialises one WorkflowSlot per resolved
 * approver, all carrying the line's `sequence`. An escalation ADD slot also
 * carries the sequence of the line it escalates. So within a level, slots
 * sharing a `sequence` are one *logical slot* — a pool in which any one
 * holder acting satisfies the pool (a ROLE pool, or original approver +
 * escalation target, "either may satisfy the slot").
 *
 * Quorum. Logical slots are grouped by `parallelGroup` (null → each logical
 * slot is its own group). Within a group the rule of the group's lines
 * applies:
 *   ALL     every mandatory logical slot is satisfied
 *   ANY     at least one mandatory logical slot is satisfied
 *   N_OF_M  at least quorumN logical slots (mandatory or not) are satisfied
 * A logical slot whose every physical slot is Skipped / Vacant / Replaced is
 * out of play: it does not gate ALL and does not count towards N. A group
 * with no logical slot in play is satisfied (auto-satisfied level, §11.1).
 * The level is satisfied when every group is.
 *
 * Sequential-within-level offering (§7.7, null parallelGroup offered one at
 * a time by sequence) is not implemented: all slots of a level are offered
 * at level entry. Gating is identical; only the inbox timing differs.
 */

export type QuorumSlot = {
  sequence: number;
  parallelGroup: number | null;
  isMandatory: boolean;
  quorumRule: string;
  quorumN: number | null;
  status: string;
};

export const OUT_OF_PLAY: ReadonlySet<string> = new Set(['Skipped', 'Vacant', 'Replaced']);

type Logical = { sequence: number; parallelGroup: number | null; mandatory: boolean; satisfied: boolean; inPlay: boolean };

function logicalSlots(slots: readonly QuorumSlot[]): Logical[] {
  const bySeq = new Map<number, QuorumSlot[]>();
  for (const s of slots) {
    const list = bySeq.get(s.sequence);
    if (list) list.push(s);
    else bySeq.set(s.sequence, [s]);
  }
  const out: Logical[] = [];
  for (const [sequence, list] of bySeq) {
    const inPlay = list.some((s) => !OUT_OF_PLAY.has(s.status));
    out.push({
      sequence,
      parallelGroup: list[0].parallelGroup,
      mandatory: list.some((s) => s.isMandatory),
      satisfied: list.some((s) => s.status === 'Approved'),
      inPlay,
    });
  }
  return out;
}

export type LevelEvaluation = {
  satisfied: boolean;
  /** True when nothing at the level is in play (every slot Skipped/Vacant/Replaced). */
  nothingInPlay: boolean;
  groups: Array<{ key: string; rule: string; satisfied: boolean; inPlay: number; approved: number }>;
};

/** Evaluate all slots of ONE level. */
export function evaluateLevel(slots: readonly QuorumSlot[]): LevelEvaluation {
  const logical = logicalSlots(slots);
  const groups = new Map<string, { rule: string; quorumN: number | null; members: Logical[] }>();
  for (const l of logical) {
    const key = l.parallelGroup === null ? `seq:${l.sequence}` : `pg:${l.parallelGroup}`;
    let g = groups.get(key);
    if (!g) {
      const first = slots.find((s) => s.sequence === l.sequence)!;
      g = { rule: (first.quorumRule || 'ALL').toUpperCase(), quorumN: first.quorumN ?? null, members: [] };
      groups.set(key, g);
    }
    g.members.push(l);
  }

  const result: LevelEvaluation['groups'] = [];
  let all = true;
  let anyInPlay = false;
  for (const [key, g] of groups) {
    const inPlay = g.members.filter((m) => m.inPlay);
    const approved = inPlay.filter((m) => m.satisfied);
    if (inPlay.length > 0) anyInPlay = true;
    let ok: boolean;
    if (inPlay.length === 0) ok = true;
    else if (g.rule === 'ANY') {
      const mandatory = inPlay.filter((m) => m.mandatory);
      ok = (mandatory.length > 0 ? mandatory : inPlay).some((m) => m.satisfied);
    } else if (g.rule === 'N_OF_M') {
      const n = g.quorumN ?? inPlay.length;
      ok = approved.length >= Math.min(n, inPlay.length);
    } else {
      // ALL — every mandatory logical slot; optional slots are advisory.
      const mandatory = inPlay.filter((m) => m.mandatory);
      ok = mandatory.every((m) => m.satisfied);
    }
    if (!ok) all = false;
    result.push({ key, rule: g.rule, satisfied: ok, inPlay: inPlay.length, approved: approved.length });
  }
  return { satisfied: all, nothingInPlay: !anyInPlay, groups: result };
}
