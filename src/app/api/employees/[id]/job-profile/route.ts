/**
 * GET /api/employees/[id]/job-profile   — Job Profile tab (extended JobInfo
 *                                          fields on the current record + linked User)
 * PUT /api/employees/[id]/job-profile   — atomic save, logs an EmployeeActivity entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { jobProfileSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id: parseInt(id), deletedAt: null },
    include: { jobInfos: { where: { effectiveTo: null }, take: 1 } },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const currentJob = employee.jobInfos[0] ?? null;

  return NextResponse.json({
    userId: employee.userId,
    wageType: currentJob?.wageType ?? null,
    paymentMode: currentJob?.paymentMode ?? null,
    officialEmail: currentJob?.officialEmail ?? null,
    petrolAllowance: currentJob?.petrolAllowance ?? false,
    esiApplicable: currentJob?.esiApplicable ?? false,
    professionalTaxApplicable: currentJob?.professionalTaxApplicable ?? false,
    bonusApplicable: currentJob?.bonusApplicable ?? false,
    ltaEligible: currentJob?.ltaEligible ?? false,
    pfRestrictionAmount: currentJob?.pfRestrictionAmount ?? null,
    overtimeAllowed: currentJob?.overtimeAllowed ?? false,
    overtimeFactor: currentJob?.overtimeFactor ?? null,
    overtimeRatePerHour: currentJob?.overtimeRatePerHour ?? null,
    lossOfMinutesDeductionApplicable: currentJob?.lossOfMinutesDeductionApplicable ?? false,
    allowedLossOfMinutes: currentJob?.allowedLossOfMinutes ?? null,
    numberOfLeavesAllowed: currentJob?.numberOfLeavesAllowed ?? null,
    permissionRequestAllowed: currentJob?.permissionRequestAllowed ?? false,
    permissionHours: currentJob?.permissionHours ?? null,
    companyContact1: currentJob?.companyContact1 ?? null,
    companyContact2: currentJob?.companyContact2 ?? null,
    ipAddress1: currentJob?.ipAddress1 ?? null,
    ipAddress2: currentJob?.ipAddress2 ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const body = await request.json();
  const parsed = jobProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { userId, ...jobInfoFields } = parsed.data;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: { jobInfos: { where: { effectiveTo: null }, take: 1 } },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  if (userId) {
    const conflict = await prisma.employee.findFirst({
      where: { userId, NOT: { id: employeeId } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: 'This user account is already linked to another employee' },
        { status: 409 }
      );
    }
  }

  const currentJob = employee.jobInfos[0];
  if (!currentJob) {
    return NextResponse.json(
      { error: 'Complete Basic Details first — no current job record exists to attach Job Profile fields to.' },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { userId: userId ?? null } });
    const job = await tx.jobInfo.update({ where: { id: currentJob.id }, data: jobInfoFields });

    await logActivity(tx, {
      employeeId,
      activityType: 'job_profile_updated',
      module: 'job_profile',
      performedByUserId,
      newValue: { wageType: jobInfoFields.wageType, paymentMode: jobInfoFields.paymentMode },
    });

    return job;
  });

  return NextResponse.json(updated);
}
