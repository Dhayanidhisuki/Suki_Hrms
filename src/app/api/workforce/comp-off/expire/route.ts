/**
 * POST /api/workforce/comp-off/expire
 *
 * Scheduled job — expires comp-off days that have exceeded the
 * CompOffPolicy.expiryMonths window. Should be called monthly (e.g. on
 * the 1st of each month) via a cron trigger or manual admin action.
 *
 * Logic:
 *   1. Load the company's CompOffPolicy (skip if no policy or expiryMonths=0).
 *   2. For each employee with a positive CompOffBalance:
 *      a. Find CREDIT transactions older than (today - expiryMonths).
 *      b. Sum the unexpired days (credits minus debits/encashments since).
 *      c. If the expired portion > 0, call expireCompOff.
 *
 * This is a simplified first-in-first-out (FIFO) expiry — oldest credits
 * expire first. A more sophisticated per-credit expiry would track each
 * credit's remaining balance separately, but FIFO is the standard
 * convention for comp-off.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { expireCompOff } from '@/lib/compOffTransactions';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'workforce.attendance.manage');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const policy = await prisma.compOffPolicy.findUnique({ where: { companyId: scope.companyId } });
  if (!policy || !policy.isActive || policy.expiryMonths <= 0) {
    return NextResponse.json({ message: 'No active comp-off policy with expiry configured — nothing to expire', expired: 0 });
  }

  const cutoffDate = new Date();
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - policy.expiryMonths);

  // Find all employees with positive comp-off balance for this company.
  const balances = await prisma.compOffBalance.findMany({
    where: {
      employee: { companyId: scope.companyId, deletedAt: null },
      balance: { gt: 0 },
    },
  });

  let totalExpired = 0;
  const expiredEmployees: Array<{ employeeId: number; expiredDays: number }> = [];

  for (const bal of balances) {
    // Sum credits older than the cutoff that haven't been debited yet.
    // FIFO: oldest credits expire first. We compute:
    //   expiredCredits = sum of CREDIT days before cutoff
    //   usedAfterCutoff = sum of |DEBIT| + |ENCASH| days after the oldest expired credit
    //   expirable = max(0, expiredCredits - usedAfterCutoff)
    const oldCredits = await prisma.compOffTransaction.aggregate({
      where: {
        employeeId: bal.employeeId,
        type: 'CREDIT',
        date: { lt: cutoffDate },
      },
      _sum: { days: true },
    });
    const expiredCredits = Number(oldCredits._sum.days ?? 0);
    if (expiredCredits <= 0) continue;

    // How many of those old credits were used after the cutoff?
    const usageAfterCutoff = await prisma.compOffTransaction.aggregate({
      where: {
        employeeId: bal.employeeId,
        type: { in: ['DEBIT', 'ENCASH'] },
        date: { gte: cutoffDate },
      },
      _sum: { days: true },
    });
    const usedAfter = Math.abs(Number(usageAfterCutoff._sum.days ?? 0));

    // Expirable = old credits not yet used (FIFO assumption).
    const expirable = Math.max(0, Math.min(expiredCredits - usedAfter, Number(bal.balance)));
    if (expirable <= 0) continue;

    await expireCompOff(
      bal.employeeId,
      expirable,
      new Date(),
      `Auto-expiry: credits older than ${policy.expiryMonths} month(s)`
    );
    totalExpired += expirable;
    expiredEmployees.push({ employeeId: bal.employeeId, expiredDays: expirable });
  }

  return NextResponse.json({
    message: `Expired ${totalExpired} comp-off day(s) across ${expiredEmployees.length} employee(s)`,
    expired: totalExpired,
    employees: expiredEmployees,
    cutoffDate: cutoffDate.toISOString().slice(0, 10),
  });
}
