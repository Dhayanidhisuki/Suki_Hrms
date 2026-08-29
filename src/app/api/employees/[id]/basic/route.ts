/**
 * GET /api/employees/[id]/basic   — Basic Details tab (Employee identity/
 *                                    classification + current JobInfo)
 * PUT /api/employees/[id]/basic   — atomic save, logs an EmployeeActivity entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { basicDetailsSchema } from '@/lib/validations/employee';
import { logActivity } from '@/lib/activity-log';
import { calculateProbationEndDate } from '@/lib/employee-form-fields';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: {
      jobInfos: { where: { effectiveTo: null }, take: 1 },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const currentJob = employee.jobInfos[0] ?? null;

  return NextResponse.json({
    companyId: employee.companyId,
    title: employee.title,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,
    employeeCode: employee.employeeCode,
    oldEmployeeCode: employee.oldEmployeeCode,
    status: employee.status,
    reportingManagerId: employee.reportingManagerId,
    profilePhotoPath: employee.profilePhotoPath,
    signaturePath: employee.signaturePath,
    departmentId: currentJob?.departmentId ?? null,
    subDepartmentId: currentJob?.subDepartmentId ?? null,
    designationId: currentJob?.designationId ?? null,
    employeeTypeId: currentJob?.employeeTypeId ?? null,
    categoryId: currentJob?.categoryId ?? null,
    subCategory: currentJob?.subCategory ?? null,
    gradeId: currentJob?.gradeId ?? null,
    levelId: currentJob?.levelId ?? null,
    unitId: currentJob?.unitId ?? null,
    productionLine: currentJob?.productionLine ?? null,
    additionalRole: currentJob?.additionalRole ?? null,
    teamGroup: currentJob?.teamGroup ?? null,
    joinDate: currentJob?.joinDate ?? null,
    probationPeriodMonths: currentJob?.probationPeriodMonths ?? null,
    probationEndDate: currentJob?.probationEndDate ?? null,
    confirmationDate: currentJob?.confirmationDate ?? null,
    shiftMasterId: currentJob?.shiftMasterId ?? null,
    shiftPlanId: currentJob?.shiftPlanId ?? null,
  });
}

async function wouldCreateCycle(employeeId: number, candidateManagerId: number): Promise<boolean> {
  if (candidateManagerId === employeeId) return true;
  let currentId: number | null = candidateManagerId;
  for (let depth = 0; depth < 50 && currentId !== null; depth++) {
    const manager: { reportingManagerId: number | null } | null = await prisma.employee.findUnique({
      where: { id: currentId },
      select: { reportingManagerId: true },
    });
    if (!manager) break;
    if (manager.reportingManagerId === employeeId) return true;
    currentId = manager.reportingManagerId;
  }
  return false;
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
  const parsed = basicDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existingEmployee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: { jobInfos: { where: { effectiveTo: null }, take: 1 } },
  });
  if (!existingEmployee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  if (data.reportingManagerId) {
    if (await wouldCreateCycle(employeeId, data.reportingManagerId)) {
      return NextResponse.json(
        { error: 'Reporting manager cannot be the employee themselves or create a reporting cycle' },
        { status: 400 }
      );
    }
  }

  const codeConflict = await prisma.employee.findFirst({
    where: { companyId: data.companyId, employeeCode: data.employeeCode, NOT: { id: employeeId } },
  });
  if (codeConflict) {
    return NextResponse.json({ error: 'Employee code already exists in this company' }, { status: 409 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id: employeeId },
        data: {
          companyId: data.companyId,
          title: data.title,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          employeeCode: data.employeeCode,
          oldEmployeeCode: data.oldEmployeeCode,
          status: data.status,
          reportingManagerId: data.reportingManagerId,
          profilePhotoPath: data.profilePhotoPath,
          signaturePath: data.signaturePath,
        },
      });

      const jobInfoData = {
        departmentId: data.departmentId,
        subDepartmentId: data.subDepartmentId,
        designationId: data.designationId,
        employeeTypeId: data.employeeTypeId,
        categoryId: data.categoryId,
        subCategory: data.subCategory,
        gradeId: data.gradeId,
        levelId: data.levelId,
        unitId: data.unitId,
        productionLine: data.productionLine,
        additionalRole: data.additionalRole,
        teamGroup: data.teamGroup,
        joinDate: data.joinDate,
        probationPeriodMonths: data.probationPeriodMonths,
        probationEndDate: calculateProbationEndDate(data.joinDate, data.probationPeriodMonths),
        // confirmationDate is intentionally NOT set here — only the
        // Confirmation approval workflow may set it.
        shiftMasterId: data.shiftMasterId,
        shiftPlanId: data.shiftPlanId,
      };

      const currentJob = existingEmployee.jobInfos[0];
      if (currentJob) {
        await tx.jobInfo.update({ where: { id: currentJob.id }, data: jobInfoData });
      } else {
        await tx.jobInfo.create({
          data: { employeeId, effectiveFrom: data.joinDate, ...jobInfoData },
        });
      }

      await logActivity(tx, {
        employeeId,
        activityType: 'basic_details_updated',
        module: 'basic',
        performedByUserId,
        oldValue: {
          firstName: existingEmployee.firstName,
          lastName: existingEmployee.lastName,
          status: existingEmployee.status,
        },
        newValue: { firstName: data.firstName, lastName: data.lastName, status: data.status },
      });

      return employee;
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update basic details' },
      { status: 400 }
    );
  }
}
