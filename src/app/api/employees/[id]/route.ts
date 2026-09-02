/**
 * GET    /api/employees/[id]              — profile header summary (lightweight —
 *                                            tabs lazy-load their own data via
 *                                            dedicated routes)
 * DELETE /api/employees/[id]              — deactivate. Only flips `isActive` —
 *                                            `status` (active/on-leave/terminated/
 *                                            resigned) and `deletedAt` (reserved
 *                                            for genuine hard-delete) are untouched,
 *                                            so the profile stays reachable and
 *                                            reactivate (see .../reactivate) can
 *                                            restore it exactly as it was.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission, checkSpecificPermission } from '@/lib/rbac-employee';
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
    select: {
      id: true,
      companyId: true,
      title: true,
      firstName: true,
      middleName: true,
      lastName: true,
      employeeCode: true,
      oldEmployeeCode: true,
      profilePhotoPath: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, name: true } },
      reportingManager: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          confirmationDate: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
      },
      personalDetails: { select: { id: true } },
      contactDetails: { select: { id: true } },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const currentJob = employee.jobInfos[0] ?? null;

  return NextResponse.json({
    id: employee.id,
    companyId: employee.companyId,
    company: employee.company,
    title: employee.title,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,
    employeeCode: employee.employeeCode,
    oldEmployeeCode: employee.oldEmployeeCode,
    profilePhotoPath: employee.profilePhotoPath,
    status: employee.status,
    isActive: employee.isActive,
    reportingManager: employee.reportingManager,
    department: currentJob?.department ?? null,
    designation: currentJob?.designation ?? null,
    joinDate: currentJob?.joinDate ?? null,
    confirmationDate: currentJob?.confirmationDate ?? null,
    // Simple per-tab completion indicator for the profile header.
    tabsCompleted: {
      personal: employee.personalDetails !== null,
      contact: employee.contactDetails !== null,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'employee.deactivate');
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { isActive: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (!employee.isActive) return NextResponse.json({ error: 'Employee is already deactivated' }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });
    await logActivity(tx, {
      employeeId,
      activityType: 'deactivated',
      module: 'basic',
      performedByUserId,
      remarks: 'Employee deactivated',
    });
  });

  return NextResponse.json({ message: 'Employee deactivated' }, { status: 200 });
}
