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
import { checkPeriodEditable } from '@/lib/payrollGuard';

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

  // An import must not rewrite a period whose payroll is already approved.
  const lockErr = await checkPeriodEditable(scope.companyId, year, month);
  if (lockErr) return lockErr;

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
          // An Excel import is data entry, not sign-off. This used to stamp
          // `complete` on every imported row with no review; `complete` is now
          // what payroll pays, so imports land in `process` and someone has to
          // approve them.
          status: 'process',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        update: {
          ...amounts,
          status: 'process',
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
