/**
 * GET  /api/workforce/tds-declaration?scope=mine&financialYear=YYYY
 *      — mine: the logged-in employee's own declarations, newest first.
 * POST /api/workforce/tds-declaration
 *      — the logged-in employee submits/amends their own investment
 *        declaration for a financial year. Self-service: employeeId is
 *        resolved from the session, never taken from the request body.
 *        Submitting again for the same financial year creates a new row
 *        (the TDS engine uses the latest approved one) rather than
 *        editing the old one, preserving history.
 *
 * This is the ESS-facing counterpart to the HR-side
 * /api/payroll/tds/declarations route (RBAC-gated, sees every employee).
 * Both write the same TdsInvestmentDeclaration table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { tdsInvestmentDeclarationSchema } from '@/lib/validations/master';

function currentFinancialYear(financialYearStart: number): number {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  return month >= financialYearStart ? year : year - 1;
}

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const financialYear = searchParams.get('financialYear');

  const [regimeConfig, data] = await Promise.all([
    prisma.tdsRegimeConfig.findUnique({ where: { companyId: scope.companyId } }),
    prisma.tdsInvestmentDeclaration.findMany({
      where: { employeeId: ownEmployeeId, ...(financialYear ? { financialYear: Number(financialYear) } : {}) },
      include: { proofs: true },
      orderBy: [{ financialYear: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const fyStart = regimeConfig?.financialYearStart ?? 4;
  return NextResponse.json({
    data,
    currentFinancialYear: currentFinancialYear(fyStart),
    defaultRegime: regimeConfig?.defaultRegime ?? 'NEW',
  });
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const parsed = tdsInvestmentDeclarationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.tdsInvestmentDeclaration.create({
    data: {
      ...parsed.data,
      employeeId: ownEmployeeId,
      companyId: scope.companyId,
    },
    include: { proofs: true },
  });

  return NextResponse.json(record, { status: 201 });
}
