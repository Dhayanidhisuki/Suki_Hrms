/**
 * POST /api/payroll/double-machine/bulk — Confirm on the File Upload modal.
 * Upserts every parsed row for the selected year+month as status complete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { doubleMachineBulkSchema } from '@/lib/validations/payroll';
import { logActivity } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = doubleMachineBulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { year, month, rows } = parsed.data;
  const userId = Number(request.headers.get('x-user-id')) || null;
  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, companyId: scope.companyId, deletedAt: null },
    select: { id: true },
  });
  const allowed = new Set(employees.map((e) => e.id));
  const skipped = rows.filter((r) => !allowed.has(r.employeeId)).length;
  const toSave = rows.filter((r) => allowed.has(r.employeeId));

  const results = await prisma.$transaction(async (tx) => {
    const saved = [];
    for (const r of toSave) {
      const amounts = {
        doubleMachine: r.doubleMachine,
        attendanceBonus: r.attendanceBonus,
        shiftIncentive: r.shiftIncentive,
        otWeeklyInc: r.otWeeklyInc,
        employeeR: r.employeeR,
      };
      const row = await tx.doubleMachineIncentive.upsert({
        where: {
          employeeId_year_month: { employeeId: r.employeeId, year, month },
        },
        create: {
          companyId: scope.companyId,
          employeeId: r.employeeId,
          year,
          month,
          ...amounts,
          status: 'complete',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        update: {
          ...amounts,
          status: 'complete',
          updatedByUserId: userId,
        },
      });
      await logActivity(tx, {
        employeeId: r.employeeId,
        activityType: 'double_machine_bulk',
        module: 'double-machine',
        performedByUserId: userId,
        newValue: amounts,
        relatedRecordId: row.id,
      });
      saved.push(row);
    }
    return saved;
  });

  return NextResponse.json({
    data: { saved: results.length, skipped },
    message: `${results.length} employee(s) imported.`,
  });
}
