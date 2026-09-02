/**
 * GET /api/org-options?table=Department
 * Returns active records from an Org master table for dropdown population.
 * Only allows specific tables — no arbitrary table access.
 * Guarded by masters.org.view — same permission as the Masters org pages,
 * since this exposes the same underlying data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';

const ALLOWED_TABLES = [
  'Department',
  'SubDepartment',
  'Designation',
  'EmployeeType',
  'Category',
  'Unit',
  'Grade',
  'Level',
  'ShiftMaster',
  'ShiftPlan',
] as const;

type TableName = typeof ALLOWED_TABLES[number];

export async function GET(request: NextRequest) {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json(
      { error: 'Unauthorized — authentication required' },
      { status: 401 }
    );
  }

  const allowed = await hasPermission(Number(roleId), {
    module: 'masters',
    submodule: 'org',
    action: 'view',
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient permissions', required: 'masters.org.view' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table') as TableName;

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json(
      { error: 'Invalid or missing table parameter' },
      { status: 400 }
    );
  }

  const where = { isActive: true, deletedAt: null };
  const select = { id: true, name: true, code: true };

  let data: { id: number; name: string; code: string }[] = [];

  switch (table) {
    case 'Department':
      data = await prisma.department.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'SubDepartment':
      data = await prisma.subDepartment.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'Designation':
      data = await prisma.designation.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'EmployeeType':
      data = await prisma.employeeType.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'Category':
      data = await prisma.category.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'Unit':
      data = await prisma.unit.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'Grade':
      data = await prisma.grade.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'Level':
      data = await prisma.level.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'ShiftMaster':
      data = await prisma.shiftMaster.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
    case 'ShiftPlan':
      data = await prisma.shiftPlan.findMany({ where, select, orderBy: { name: 'asc' } });
      break;
  }

  return NextResponse.json(data);
}
