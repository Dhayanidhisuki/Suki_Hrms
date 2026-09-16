/**
 * Employee code policy (BRD 01 §7.2 / §7.3).
 *
 *   employeeCode = <prefix><zero-padded sequence>
 *
 * One `EmployeeCodePolicy` row per company holds the prefix, the minimum
 * width and the next sequence number. The sequence is allocated inside the
 * caller's transaction with the policy row locked (UPDLOCK/HOLDLOCK on SQL
 * Server) so two concurrent joiners never receive the same code, and it is
 * only consumed when that transaction commits (§7.3 rules 1–2).
 *
 * On first use the policy is derived from the codes the company already has
 * — the prefix that the most employees carry, the width of those codes and
 * one past their high-water mark — so an existing tenant keeps its series
 * (KUNAERO today: RC / 3 / next after the current max) instead of restarting
 * at EMP001.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export type CodePolicy = { prefix: string; width: number; nextSequence: number };

export const DEFAULT_CODE_POLICY: CodePolicy = { prefix: 'EMP', width: 3, nextSequence: 1 };

const CODE_PATTERN = /^([A-Za-z]{1,5})(\d+)$/;

/** `<prefix><zero-padded>`; the width is a minimum and never truncates (EMP1000 at width 3). */
export function formatEmployeeCode(prefix: string, width: number, sequence: number): string {
  return `${prefix}${String(sequence).padStart(width, '0')}`;
}

/** Parse `RC027` → { prefix: 'RC', sequence: 27, width: 3 }; null when the code is not in series form. */
export function parseEmployeeCode(code: string): { prefix: string; sequence: number; width: number } | null {
  const m = CODE_PATTERN.exec(code.trim());
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), sequence: parseInt(m[2], 10), width: m[2].length };
}

/**
 * Derive a policy from the codes already issued in a company. Picks the
 * prefix carried by the most codes (ties → the one with the higher maximum),
 * the modal width of that series and nextSequence = max + 1. Falls back to
 * the defaults when no code is in series form.
 */
export function deriveCodePolicyFromCodes(codes: string[], defaults: CodePolicy = DEFAULT_CODE_POLICY): CodePolicy {
  const series = new Map<string, { count: number; max: number; widths: Map<number, number> }>();
  for (const code of codes) {
    const parsed = parseEmployeeCode(code);
    if (!parsed) continue;
    const entry = series.get(parsed.prefix) ?? { count: 0, max: 0, widths: new Map<number, number>() };
    entry.count += 1;
    entry.max = Math.max(entry.max, parsed.sequence);
    entry.widths.set(parsed.width, (entry.widths.get(parsed.width) ?? 0) + 1);
    series.set(parsed.prefix, entry);
  }
  if (series.size === 0) return { ...defaults };

  let best: { prefix: string; count: number; max: number; widths: Map<number, number> } | null = null;
  for (const [prefix, entry] of series) {
    if (!best || entry.count > best.count || (entry.count === best.count && entry.max > best.max)) {
      best = { prefix, ...entry };
    }
  }
  const chosen = best!;
  let width = defaults.width;
  let widthCount = -1;
  for (const [w, c] of chosen.widths) {
    if (c > widthCount || (c === widthCount && w > width)) {
      width = w;
      widthCount = c;
    }
  }
  return { prefix: chosen.prefix, width, nextSequence: chosen.max + 1 };
}

/** Read the company's policy, creating it from the existing codes on first use. */
export async function getOrCreateCodePolicy(companyId: number, db: Db = prisma): Promise<CodePolicy & { id: number }> {
  const existing = await db.employeeCodePolicy.findUnique({ where: { companyId } });
  if (existing) return existing;
  const rows = await db.employee.findMany({ where: { companyId }, select: { employeeCode: true } });
  const derived = deriveCodePolicyFromCodes(rows.map((r) => r.employeeCode));
  return db.employeeCodePolicy.create({ data: { companyId, ...derived } });
}

async function lockPolicyRow(companyId: number, db: Db): Promise<void> {
  // Only meaningful inside a transaction; harmless outside one. HOLDLOCK
  // also blocks a concurrent first-use insert for the same company.
  try {
    await db.$queryRaw`SELECT id FROM [EmployeeCodePolicy] WITH (UPDLOCK, HOLDLOCK) WHERE companyId = ${companyId}`;
  } catch {
    // Non-SQL-Server engines (tests against another provider) simply skip the lock.
  }
}

/**
 * Allocate the next employee code for the company. Call inside the
 * transaction that creates the employee so the sequence is consumed only on
 * commit. Codes already present (manual overrides, imports) are skipped.
 */
export async function allocateEmployeeCode(companyId: number, db: Db): Promise<string> {
  await lockPolicyRow(companyId, db);
  const policy = await getOrCreateCodePolicy(companyId, db);

  let sequence = policy.nextSequence;
  for (let attempts = 0; attempts < 10_000; attempts++, sequence++) {
    const code = formatEmployeeCode(policy.prefix, policy.width, sequence);
    const taken = await db.employee.findFirst({ where: { companyId, employeeCode: code }, select: { id: true } });
    if (taken) continue;
    await db.employeeCodePolicy.update({ where: { companyId }, data: { nextSequence: sequence + 1 } });
    return code;
  }
  throw new Error('Employee code sequence exhausted — check the code policy');
}

/**
 * §7.3 rule 3: a manual override advances the sequence when it is
 * numerically higher than the current position of the same series.
 */
export async function noteManualCode(companyId: number, code: string, db: Db = prisma): Promise<void> {
  const parsed = parseEmployeeCode(code);
  if (!parsed) return;
  await lockPolicyRow(companyId, db);
  const policy = await getOrCreateCodePolicy(companyId, db);
  if (parsed.prefix !== policy.prefix.toUpperCase()) return;
  if (parsed.sequence >= policy.nextSequence) {
    await db.employeeCodePolicy.update({ where: { companyId }, data: { nextSequence: parsed.sequence + 1 } });
  }
}

/** §7.3 rule 4: prefix/width changes apply only to codes generated afterwards. */
export async function updateCodePolicy(
  companyId: number,
  patch: { prefix?: string; width?: number; nextSequence?: number },
  db: Db = prisma
): Promise<CodePolicy & { id: number }> {
  const current = await getOrCreateCodePolicy(companyId, db);
  const nextSequence = patch.nextSequence ?? current.nextSequence;
  if (nextSequence < current.nextSequence) {
    throw new Error('nextSequence cannot move backwards — a sequence number is never reused');
  }
  return db.employeeCodePolicy.update({
    where: { companyId },
    data: {
      prefix: (patch.prefix ?? current.prefix).toUpperCase(),
      width: patch.width ?? current.width,
      nextSequence,
    },
  });
}

/** Preview of the code the next joiner would receive (not allocated). */
export async function peekNextEmployeeCode(companyId: number, db: Db = prisma): Promise<string> {
  const policy = await getOrCreateCodePolicy(companyId, db);
  return formatEmployeeCode(policy.prefix, policy.width, policy.nextSequence);
}
