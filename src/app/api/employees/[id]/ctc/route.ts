/**
 * GET  /api/employees/[id]/ctc   — full CTC revision history, newest first
 * POST /api/employees/[id]/ctc   — add a new CTC revision, closing whatever
 *                                   revision was current. Same versioning
 *                                   approach as Salary Revisions — see that
 *                                   route's header. Manually entered values
 *                                   only; no CTC/PF/ESI/gratuity formulas
 *                                   invented here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { ctcSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeCtc.findMany({
    where: { employeeId: parseInt(id) },
    orderBy: { effectiveFrom: 'desc' },
  });
  return NextResponse.json({ data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const parsed = ctcSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.employeeCtc.findFirst({ where: { employeeId, effectiveTo: null } });
  if (current && parsed.data.effectiveFrom <= current.effectiveFrom) {
    return NextResponse.json(
      { error: 'A new revision must be effective after the current revision\'s effective date.' },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (current) {
        await tx.employeeCtc.update({ where: { id: current.id }, data: { effectiveTo: parsed.data.effectiveFrom } });
      }
      const revision = await tx.employeeCtc.create({ data: { employeeId, ...parsed.data } });
      await logActivity(tx, {
        employeeId,
        activityType: 'ctc_revised',
        module: 'ctc',
        performedByUserId,
        newValue: { annualCtc: parsed.data.annualCtc, effectiveFrom: parsed.data.effectiveFrom },
        relatedRecordId: revision.id,
      });
      return revision;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Overlap detected')) {
      return NextResponse.json({ error: 'This effective date overlaps an existing CTC revision.' }, { status: 409 });
    }
    throw err;
  }
}
