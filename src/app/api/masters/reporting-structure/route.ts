/**
 * GET  /api/masters/reporting-structure
 *      Returns the full reporting tree for the company as a nested structure.
 * PUT  /api/masters/reporting-structure
 *      Bulk update reporting manager assignments.
 *      Body: { updates: [{ employeeId, reportingManagerId?, secondReportingManagerId? }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { wouldCreateCycle } from '@/lib/reportingManager';

interface EmployeeNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  reportingManagerId: number | null;
  secondReportingManagerId: number | null;
  designation: string | null;
  department: string | null;
  directReports: EmployeeNode[];
}

export async function GET(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      reportingManagerId: true,
      secondReportingManagerId: true,
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          designation: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  // Build a map: managerId -> children
  const byManager = new Map<number | null, typeof employees>();
  for (const emp of employees) {
    const mgrId = emp.reportingManagerId ?? null;
    if (!byManager.has(mgrId)) byManager.set(mgrId, []);
    byManager.get(mgrId)!.push(emp);
  }

  function buildNode(managerId: number | null): EmployeeNode[] {
    const children = byManager.get(managerId) ?? [];
    return children.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      reportingManagerId: emp.reportingManagerId,
      secondReportingManagerId: emp.secondReportingManagerId,
      designation: emp.jobInfos[0]?.designation?.name ?? null,
      department: emp.jobInfos[0]?.department?.name ?? null,
      directReports: buildNode(emp.id),
    }));
  }

  const tree = buildNode(null);
  const totalEmployees = employees.length;
  const rootCount = tree.length;

  return NextResponse.json({
    data: tree,
    stats: { totalEmployees, rootCount },
  });
}

export async function PUT(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const body = await request.json().catch(() => null);
  if (!body?.updates || !Array.isArray(body.updates)) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
  }

  for (const update of body.updates) {
    if (typeof update.employeeId !== 'number') {
      return NextResponse.json({ error: 'employeeId is required in each update' }, { status: 400 });
    }

    // Verify employee belongs to this company
    const emp = await prisma.employee.findFirst({
      where: { id: update.employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!emp) {
      return NextResponse.json({ error: `Employee ${update.employeeId} not found` }, { status: 404 });
    }

    if (update.reportingManagerId !== undefined) {
      if (update.reportingManagerId !== null) {
        if (await wouldCreateCycle(update.employeeId, update.reportingManagerId)) {
          return NextResponse.json(
            { error: `Cycle detected: assigning ${update.employeeId} to ${update.reportingManagerId} would create a loop` },
            { status: 400 }
          );
        }
      }
      await prisma.employee.update({
        where: { id: update.employeeId },
        data: { reportingManagerId: update.reportingManagerId },
      });
    }

    if (update.secondReportingManagerId !== undefined) {
      await prisma.employee.update({
        where: { id: update.employeeId },
        data: { secondReportingManagerId: update.secondReportingManagerId },
      });
    }
  }

  return NextResponse.json({ message: `Updated ${body.updates.length} reporting assignment(s)` });
}
