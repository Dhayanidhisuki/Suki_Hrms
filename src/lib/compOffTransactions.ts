/**
 * Comp-off transaction writer — maintains CompOffBalance and CompOffTransaction
 * alongside the existing LeaveBalance ledger. The LeaveBalance ledger remains
 * the source of truth for leave availability; this layer adds an audit trail
 * with policy-driven expiry and encashment.
 *
 * Functions:
 *   creditCompOff(employeeId, days, earnedOn, sourceType, sourceId, reason)
 *   debitCompOff(employeeId, days, usedOn, sourceType, sourceId, reason)
 *   expireCompOff(employeeId, days, expiredOn, reason)
 *   encashCompOff(employeeId, days, encashedOn, reason)
 *   getCompOffBalance(employeeId)
 *   getCompOffTransactions(employeeId, options?)
 */

import { prisma } from '@/lib/prisma';

export type CompOffSourceType = 'OT_APPROVAL' | 'LEAVE' | 'MANUAL' | 'EXPIRY' | 'ENCASHMENT' | 'COMP_OFF_REQUEST';
export type CompOffTxnType = 'CREDIT' | 'DEBIT' | 'EXPIRE' | 'ENCASH';

/**
 * Credit comp-off days to an employee's balance. Writes a CompOffTransaction
 * and updates CompOffBalance. Does NOT touch LeaveBalance — the caller is
 * responsible for that (grantCompOff in leaveAccrual.ts handles it for OT
 * approvals; leave approve route handles it for leave usage).
 */
export async function creditCompOff(
  employeeId: number,
  days: number,
  earnedOn: Date,
  sourceType: CompOffSourceType,
  sourceId?: number,
  reason?: string
): Promise<void> {
  if (days <= 0) return;
  await prisma.$transaction(async (tx) => {
    const balance = await tx.compOffBalance.upsert({
      where: { employeeId },
      create: { employeeId, balance: days, earned: days },
      update: { balance: { increment: days }, earned: { increment: days } },
    });
    await tx.compOffTransaction.create({
      data: {
        employeeId,
        date: earnedOn,
        type: 'CREDIT',
        days,
        balanceAfter: balance.balance,
        reason: reason ?? `Comp-off credited (${sourceType})`,
        sourceType,
        sourceId: sourceId ?? null,
      },
    });
  });
}

/**
 * Debit comp-off days when an employee uses comp-off leave. Returns the
 * actual days debited (may be less than requested if balance is insufficient).
 */
export async function debitCompOff(
  employeeId: number,
  days: number,
  usedOn: Date,
  sourceType: CompOffSourceType,
  sourceId?: number,
  reason?: string
): Promise<number> {
  if (days <= 0) return 0;
  const current = await prisma.compOffBalance.findUnique({ where: { employeeId } });
  const available = current ? Number(current.balance) : 0;
  const debitDays = Math.min(days, available);
  if (debitDays <= 0) return 0;

  await prisma.$transaction(async (tx) => {
    const balance = await tx.compOffBalance.update({
      where: { employeeId },
      data: { balance: { decrement: debitDays }, used: { increment: debitDays } },
    });
    await tx.compOffTransaction.create({
      data: {
        employeeId,
        date: usedOn,
        type: 'DEBIT',
        days: -debitDays,
        balanceAfter: balance.balance,
        reason: reason ?? `Comp-off used (${sourceType})`,
        sourceType,
        sourceId: sourceId ?? null,
      },
    });
  });
  return debitDays;
}

/**
 * Expire comp-off days that have passed the policy's expiry window.
 * Called by the scheduled expiry job.
 */
export async function expireCompOff(
  employeeId: number,
  days: number,
  expiredOn: Date,
  reason?: string
): Promise<void> {
  if (days <= 0) return;
  await prisma.$transaction(async (tx) => {
    const balance = await tx.compOffBalance.update({
      where: { employeeId },
      data: { balance: { decrement: days }, expired: { increment: days } },
    });
    await tx.compOffTransaction.create({
      data: {
        employeeId,
        date: expiredOn,
        type: 'EXPIRE',
        days: -days,
        balanceAfter: balance.balance,
        reason: reason ?? 'Comp-off expired (policy expiry window)',
        sourceType: 'EXPIRY',
      },
    });
  });
}

/**
 * Encash comp-off days at exit or year-end. Returns the encashment amount
 * based on the CompOffPolicy.encashmentRatePerDay (or daily gross rate if
 * not configured). The caller is responsible for adding the encashment
 * amount to payroll.
 */
export async function encashCompOff(
  employeeId: number,
  days: number,
  encashedOn: Date,
  encashmentRatePerDay: number,
  reason?: string
): Promise<number> {
  if (days <= 0) return 0;
  const current = await prisma.compOffBalance.findUnique({ where: { employeeId } });
  const available = current ? Number(current.balance) : 0;
  const encashDays = Math.min(days, available);
  if (encashDays <= 0) return 0;

  await prisma.$transaction(async (tx) => {
    const balance = await tx.compOffBalance.update({
      where: { employeeId },
      data: { balance: { decrement: encashDays }, encashed: { increment: encashDays } },
    });
    await tx.compOffTransaction.create({
      data: {
        employeeId,
        date: encashedOn,
        type: 'ENCASH',
        days: -encashDays,
        balanceAfter: balance.balance,
        reason: reason ?? `Comp-off encashed at ${encashmentRatePerDay}/day`,
        sourceType: 'ENCASHMENT',
      },
    });
  });
  return encashDays * encashmentRatePerDay;
}

/**
 * Get an employee's current comp-off balance (creates a zero row if none).
 */
export async function getCompOffBalance(employeeId: number) {
  const balance = await prisma.compOffBalance.findUnique({ where: { employeeId } });
  return balance ?? { employeeId, balance: 0, earned: 0, used: 0, expired: 0, encashed: 0 };
}

/**
 * Get an employee's comp-off transaction history.
 */
export async function getCompOffTransactions(
  employeeId: number,
  options?: { limit?: number; offset?: number; type?: CompOffTxnType }
) {
  const where: Record<string, unknown> = { employeeId };
  if (options?.type) where.type = options.type;
  return prisma.compOffTransaction.findMany({
    where,
    orderBy: { date: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}
