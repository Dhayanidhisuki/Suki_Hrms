/**
 * GET  /api/workforce/my-leave-encashment
 *   The logged-in employee's own encashment requests, plus what they are
 *   currently eligible to encash. Self-service: employeeId is resolved from
 *   the session, never taken from the client.
 * POST /api/workforce/my-leave-encashment
 *   Submit a request for a number of days. Lands at SUBMITTED for HR.
 *
 * The eligibility figures mirror GET /api/payroll/leave-encashment (the
 * HR-side calculator) deliberately — same config, same encashable-leave
 * filter, same per-day basis — so the employee and HR never see different
 * numbers for the same request. Amounts are ESTIMATES: the final figure is
 * settled by payroll at payout, which is why only estimatedAmount is stored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

/** Codes treated as encashable when the config says earned-leave only. */
const EARNED_LEAVE_CODES = ['EL', 'PL'];

const createSchema = z.object({
  leaveMasterId: z.coerce.number().int().positive(),
  daysRequested: z.coerce.number().positive().max(365),
  remark: z.string().max(500).optional(),
});

/** Shared so the list view and the submit path cannot drift apart. */
async function buildEligibility(employeeId: number, companyId: number) {
  const [config, balances, lastLine] = await Promise.all([
    prisma.leaveEncashmentConfig.findUnique({ where: { companyId } }),
    prisma.leaveBalance.findMany({ where: { employeeId }, include: { leaveMaster: true } }),
    prisma.payrollLine.findFirst({
      where: { employeeId },
      orderBy: { payrollRun: { year: 'desc' } },
      include: { components: { include: { salaryComponent: true } } },
    }),
  ]);

  if (!config) return { config: null, encashable: [], totalAvailableDays: 0, perDaySalary: 0 };

  const encashable = (config.includeEarnedOnly
    ? balances.filter((b) => EARNED_LEAVE_CODES.includes(b.leaveMaster?.code ?? ''))
    : balances
  ).map((b) => ({
    leaveMasterId: b.leaveMasterId,
    code: b.leaveMaster?.code ?? '',
    name: b.leaveMaster?.name ?? '',
    available: Number(b.closingBalance),
  }));

  const totalAvailableDays = encashable.reduce((s, b) => s + b.available, 0);

  const denominator = config.denominator ?? 26;
  let perDaySalary = 0;
  if (lastLine) {
    if (config.calculationBasis === 'GROSS') {
      perDaySalary = Number(lastLine.grossEarnings) / denominator;
    } else if (config.calculationBasis === 'BASIC') {
      const basic = lastLine.components.find((c) => c.salaryComponent.code === 'BASIC');
      perDaySalary = basic ? Number(basic.amount) / denominator : 0;
    } else if (config.calculationBasis === 'BASIC_DA') {
      const total = lastLine.components
        .filter((c) => c.salaryComponent.code === 'BASIC' || c.salaryComponent.code === 'DA')
        .reduce((s, c) => s + Number(c.amount), 0);
      perDaySalary = total / denominator;
    }
  }

  return { config, encashable, totalAvailableDays, perDaySalary };
}

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const [requests, eligibility] = await Promise.all([
    prisma.leaveEncashmentRequest.findMany({
      where: { employeeId, companyId: scope.companyId },
      orderBy: { requestedAt: 'desc' },
    }),
    buildEligibility(employeeId, scope.companyId),
  ]);

  const { config, encashable, totalAvailableDays, perDaySalary } = eligibility;

  return NextResponse.json({
    data: requests.map((r) => ({
      id: r.id,
      leaveMasterId: r.leaveMasterId,
      leaveYear: r.leaveYear,
      daysRequested: Number(r.daysRequested),
      daysApproved: r.daysApproved === null ? null : Number(r.daysApproved),
      estimatedAmount: r.estimatedAmount === null ? null : Number(r.estimatedAmount),
      finalAmount: r.finalAmount === null ? null : Number(r.finalAmount),
      status: r.status,
      remark: r.remark,
      requestedAt: r.requestedAt,
    })),
    eligibility: {
      configured: config !== null,
      encashable,
      totalAvailableDays,
      maxEncashableDays: config?.maxEncashableDays ?? null,
      perDaySalary: Number(perDaySalary.toFixed(2)),
      calculationBasis: config?.calculationBasis ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { config, encashable, perDaySalary } = await buildEligibility(employeeId, scope.companyId);
  if (!config) {
    return NextResponse.json({ error: 'Leave encashment is not configured for your company yet — contact HR.' }, { status: 400 });
  }

  const bucket = encashable.find((b) => b.leaveMasterId === parsed.data.leaveMasterId);
  if (!bucket) {
    return NextResponse.json({ error: 'That leave type is not encashable.' }, { status: 400 });
  }
  if (parsed.data.daysRequested > bucket.available) {
    return NextResponse.json(
      { error: `You have only ${bucket.available} day(s) of ${bucket.name} available to encash.` },
      { status: 400 }
    );
  }

  // One open request per leave type — a second would let the same balance be
  // claimed twice before HR has decided on the first.
  const open = await prisma.leaveEncashmentRequest.findFirst({
    where: {
      employeeId,
      leaveMasterId: parsed.data.leaveMasterId,
      status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'QUEUED_FOR_PAYROLL'] },
    },
    select: { id: true, status: true },
  });
  if (open) {
    return NextResponse.json(
      { error: `You already have an encashment request for this leave type awaiting settlement (#${open.id}, ${open.status}).` },
      { status: 409 }
    );
  }

  // Cap by the company's annual ceiling, counting what is already settled or
  // in flight this leave year.
  const now = new Date();
  const leaveYear = `${now.getUTCFullYear()}-${String((now.getUTCFullYear() + 1) % 100).padStart(2, '0')}`;
  if (config.maxEncashableDays !== null) {
    const priorDays = await prisma.leaveEncashmentRequest.aggregate({
      where: { employeeId, leaveYear, status: { notIn: ['REJECTED', 'CANCELLED', 'LAPSED_ON_EXIT'] } },
      _sum: { daysRequested: true },
    });
    const already = Number(priorDays._sum.daysRequested ?? 0);
    if (already + parsed.data.daysRequested > config.maxEncashableDays) {
      return NextResponse.json(
        { error: `This exceeds the ${config.maxEncashableDays}-day annual encashment limit — you have already requested ${already} day(s) this leave year.` },
        { status: 400 }
      );
    }
  }

  const created = await prisma.leaveEncashmentRequest.create({
    data: {
      companyId: scope.companyId,
      employeeId,
      leaveMasterId: parsed.data.leaveMasterId,
      leaveYear,
      daysRequested: parsed.data.daysRequested,
      estimatedAmount: Number((perDaySalary * parsed.data.daysRequested).toFixed(2)),
      status: 'SUBMITTED',
      remark: parsed.data.remark ?? null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
