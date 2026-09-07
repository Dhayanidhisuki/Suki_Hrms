/**
 * POST /api/payroll/revisions/[id]/approve
 *
 * SUBMITTED → APPROVED: versions the employee's salary (applySalaryRevision,
 * same logic the Employee > Salary tab uses) and, if the effective date is
 * retroactive against payroll already run for this company, calculates a
 * month-wise arrear. The arrear (if any) is included in the response so the
 * UI can point straight to the Arrears page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { applySalaryRevision } from '@/lib/salaryRevisioning';
import { calculateArrear } from '@/lib/arrearCalculation';
import { logActivity } from '@/lib/activity-log';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'payroll.revision.approve');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { id } = await params;
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const record = await prisma.salaryRevisionRequest.findFirst({
    where: { id: Number(id), companyId: scope.companyId },
    include: { components: true },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'SUBMITTED') {
    return NextResponse.json({ error: `Cannot approve a revision in ${record.status} status.` }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const revision = await applySalaryRevision(tx, {
        employeeId: record.employeeId,
        grossSalary: Number(record.revisedGross),
        effectiveFrom: record.effectiveFrom,
        components: record.components.map((c) => ({ salaryComponentId: c.salaryComponentId, amount: Number(c.revisedAmount) })),
        performedByUserId,
      });

      await tx.salaryRevisionRequest.update({
        where: { id: record.id },
        data: {
          status: 'APPROVED',
          appliedRevisionId: revision.id,
          approvedByUserId: performedByUserId,
          approvedAt: new Date(),
        },
      });

      await logActivity(tx, {
        employeeId: record.employeeId,
        activityType: 'salary_revised',
        module: 'salary',
        performedByUserId,
        newValue: { grossSalary: record.revisedGross, effectiveFrom: record.effectiveFrom, revisionRequestId: record.id },
        relatedRecordId: revision.id,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Overlap detected') || message.includes('must be effective after')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw err;
  }

  const arrear = await calculateArrear(record.id);

  const updated = await prisma.salaryRevisionRequest.findUnique({
    where: { id: record.id },
    include: { arrear: true },
  });

  return NextResponse.json({ revision: updated, arrear });
}
