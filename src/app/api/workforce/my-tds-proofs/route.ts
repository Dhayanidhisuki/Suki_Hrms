/**
 * GET  /api/workforce/my-tds-proofs?financialYear=YYYY
 *   Investment proofs the logged-in employee has attached to their own
 *   declaration for that financial year.
 * POST /api/workforce/my-tds-proofs  (multipart)
 *   fields: declarationId, section, amount, description?, file?
 *   Attaches a proof to one of the caller's OWN declarations.
 *
 * Self-service counterpart to /api/payroll/tds/declarations/[id]/proofs,
 * which is RBAC-gated and covers every employee. Both write
 * TdsInvestmentProof. Without this an employee could declare investments but
 * had no way to evidence them, which is the usual reason a declaration is
 * rejected.
 *
 * The file goes through the same saveUploadedFile helper the rest of the app
 * uses; only the served path is stored on the row, never the raw upload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { saveUploadedFile } from '@/lib/file-storage';

const SECTIONS = ['80C', '80D', '80CCD', '80G', '80E', '80TTA', 'OTHER', 'HRA'] as const;

/** A declaration the caller owns, or null — never trusts a client-sent id alone. */
async function ownDeclaration(declarationId: number, employeeId: number, companyId: number) {
  return prisma.tdsInvestmentDeclaration.findFirst({
    where: { id: declarationId, employeeId, companyId },
    select: { id: true, status: true, financialYear: true },
  });
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

  const fy = Number(request.nextUrl.searchParams.get('financialYear'));
  const proofs = await prisma.tdsInvestmentProof.findMany({
    where: {
      declaration: {
        employeeId,
        companyId: scope.companyId,
        ...(fy ? { financialYear: fy } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      declarationId: true,
      section: true,
      amount: true,
      description: true,
      documentUrl: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: proofs.map((p) => ({ ...p, amount: Number(p.amount) })),
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

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'Expected a multipart form submission' }, { status: 400 });
  }

  const declarationId = Number(form.get('declarationId'));
  const section = String(form.get('section') ?? '');
  const amount = Number(form.get('amount'));
  const description = form.get('description') ? String(form.get('description')).slice(0, 500) : null;

  if (!declarationId || !SECTIONS.includes(section as (typeof SECTIONS)[number]) || !(amount >= 0)) {
    return NextResponse.json(
      { error: 'declarationId, a valid section and a non-negative amount are required' },
      { status: 400 }
    );
  }

  const declaration = await ownDeclaration(declarationId, employeeId, scope.companyId);
  if (!declaration) {
    return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  }
  // Once HR has decided, the evidence base must not move under that decision.
  if (declaration.status !== 'pending_hr') {
    return NextResponse.json(
      { error: `This declaration is already ${declaration.status} — proofs can only be added while it is awaiting HR review.` },
      { status: 409 }
    );
  }

  let documentUrl: string | null = null;
  const file = form.get('file');
  if (file && typeof file !== 'string' && file.size > 0) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = await saveUploadedFile(buffer, `tds-proofs/${employeeId}`, file.name);
      documentUrl = `/api/uploads/${key}`;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not store the uploaded file' },
        { status: 400 }
      );
    }
  }

  const created = await prisma.tdsInvestmentProof.create({
    data: {
      declarationId,
      section,
      amount,
      description,
      documentUrl,
      status: 'pending',
    },
  });

  return NextResponse.json({ ...created, amount: Number(created.amount) }, { status: 201 });
}
