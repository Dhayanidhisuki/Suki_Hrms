/**
 * GET  /api/employees/[id]/salary   — full salary revision history, newest
 *                                      first, each with its component breakdown
 * POST /api/employees/[id]/salary   — add a new revision effective from a
 *                                      given date. Closes whatever revision
 *                                      was current (effectiveTo = new row's
 *                                      effectiveFrom) so the two ranges meet
 *                                      but never overlap — tr_EmployeeSalaryRevision_no_overlap
 *                                      is the DB-level backstop if that logic
 *                                      is ever bypassed. Revisions are
 *                                      immutable history — no PUT/DELETE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { salaryRevisionSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const { id } = await params;
  const data = await prisma.employeeSalaryRevision.findMany({
    where: { employeeId: parseInt(id) },
    include: { components: { include: { salaryComponent: { select: { name: true, code: true, type: true } } } } },
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

  const parsed = salaryRevisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { components, ...revisionFields } = parsed.data;

  const current = await prisma.employeeSalaryRevision.findFirst({ where: { employeeId, effectiveTo: null } });
  if (current && revisionFields.effectiveFrom <= current.effectiveFrom) {
    return NextResponse.json(
      { error: 'A new revision must be effective after the current revision\'s effective date.' },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (current) {
        await tx.employeeSalaryRevision.update({ where: { id: current.id }, data: { effectiveTo: revisionFields.effectiveFrom } });
      }
      const revision = await tx.employeeSalaryRevision.create({
        data: {
          employeeId,
          ...revisionFields,
          lastUpdatedByUserId: performedByUserId,
          components: { create: components.map((c) => ({ salaryComponentId: c.salaryComponentId, amount: c.amount })) },
        },
        include: { components: { include: { salaryComponent: { select: { name: true, code: true, type: true } } } } },
      });
      await logActivity(tx, {
        employeeId,
        activityType: 'salary_revised',
        module: 'salary',
        performedByUserId,
        newValue: { grossSalary: revisionFields.grossSalary, effectiveFrom: revisionFields.effectiveFrom },
        relatedRecordId: revision.id,
      });
      return revision;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Overlap detected')) {
      return NextResponse.json({ error: 'This effective date overlaps an existing salary revision.' }, { status: 409 });
    }
    throw err;
  }
}
