/**
 * GET  /api/payroll/tds/declarations/[id]/proofs
 *   Returns all proofs for a declaration.
 * POST /api/payroll/tds/declarations/[id]/proofs
 *   Adds a proof to a declaration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { tdsInvestmentProofSchema } from '@/lib/validations/master';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const declarationId = parseInt(id);

  const declaration = await prisma.tdsInvestmentDeclaration.findFirst({
    where: { id: declarationId, companyId: scope.companyId },
  });
  if (!declaration) {
    return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  }

  const proofs = await prisma.tdsInvestmentProof.findMany({
    where: { declarationId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: proofs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const declarationId = parseInt(id);

  const declaration = await prisma.tdsInvestmentDeclaration.findFirst({
    where: { id: declarationId, companyId: scope.companyId },
  });
  if (!declaration) {
    return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  }

  const parsed = tdsInvestmentProofSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const proof = await prisma.tdsInvestmentProof.create({
    data: {
      declarationId,
      ...parsed.data,
      description: parsed.data.description ?? null,
      documentUrl: parsed.data.documentUrl ?? null,
    },
  });

  return NextResponse.json(proof, { status: 201 });
}
