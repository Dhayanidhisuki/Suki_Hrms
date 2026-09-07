/**
 * GET /api/employees/export — CSV export of the Employee Master list,
 * honoring the same search/status/department/designation/type filters as
 * the list view. Gated by employee.export (distinct from employee.view —
 * being able to see the list doesn't imply being able to extract it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.export');
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status');
  const departmentId = searchParams.get('departmentId');
  const designationId = searchParams.get('designationId');
  const employeeTypeId = searchParams.get('employeeTypeId');

  const jobInfoFilter =
    departmentId || designationId || employeeTypeId
      ? {
          some: {
            effectiveTo: null,
            ...(departmentId ? { departmentId: parseInt(departmentId) } : {}),
            ...(designationId ? { designationId: parseInt(designationId) } : {}),
            ...(employeeTypeId ? { employeeTypeId: parseInt(employeeTypeId) } : {}),
          },
        }
      : undefined;

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(jobInfoFilter ? { jobInfos: jobInfoFilter } : {}),
    ...(search
      ? {
          OR: [
            { employeeCode: { contains: search } },
            { oldEmployeeCode: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { employeeCode: 'asc' },
    include: {
      company: { select: { name: true } },
      reportingManager: { select: { firstName: true, lastName: true, employeeCode: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
          employeeType: { select: { name: true } },
          unit: { select: { name: true } },
        },
      },
    },
  });

  const header = [
    'Employee Code', 'Reference Code', 'First Name', 'Middle Name', 'Last Name',
    'Company', 'Unit', 'Department', 'Designation', 'Employee Type',
    'Reporting Manager', 'Status', 'Is Active', 'Join Date',
  ];

  const rows = employees.map((e) => {
    const job = e.jobInfos[0];
    return [
      e.oldEmployeeCode, e.employeeCode, e.firstName, e.middleName, e.lastName,
      e.company?.name, job?.unit?.name, job?.department?.name, job?.designation?.name, job?.employeeType?.name,
      e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName} (Ref: ${e.reportingManager.employeeCode})` : '',
      e.status, e.isActive ? 'Yes' : 'No', job?.joinDate ? job.joinDate.toISOString().slice(0, 10) : '',
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const filename = `employee-master-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
