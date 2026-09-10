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
      reportingManager: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      secondReportingManager: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          designation: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { employeeCode: 'asc' }],
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
  const assignedCount = employees.filter((e) => e.reportingManagerId !== null).length;
  const unassignedCount = totalEmployees - assignedCount;

  // Set of IDs who are managers to at least 1 employee
  const managerIds = new Set<number>();
  for (const emp of employees) {
    if (emp.reportingManagerId) managerIds.add(emp.reportingManagerId);
  }

  // Flat list for table view & easy searching
  const flat = employees.map((emp) => {
    const directCount = (byManager.get(emp.id) ?? []).length;
    return {
      id: emp.id,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`.trim(),
      reportingManagerId: emp.reportingManagerId,
      secondReportingManagerId: emp.secondReportingManagerId,
      reportingManager: emp.reportingManager,
      secondReportingManager: emp.secondReportingManager,
      designation: emp.jobInfos[0]?.designation?.name ?? null,
      department: emp.jobInfos[0]?.department?.name ?? null,
      directReportsCount: directCount,
      isManager: directCount > 0,
    };
  });

  // Manager options list for dropdowns (all employees with designations)
  const managers = flat.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: e.fullName,
    designation: e.designation,
    department: e.department,
    isManager: e.isManager,
    directReportsCount: e.directReportsCount,
  }));

  return NextResponse.json({
    data: tree,
    flat,
    managers,
    stats: {
      totalEmployees,
      rootCount,
      assignedCount,
      unassignedCount,
      managersCount: managerIds.size,
    },
  });
}

export async function PUT(request: NextRequest) {
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const body = await request.json().catch(() => null);

  // Support both bulk assignment by employeeIds array OR updates array
  let updates: Array<{
    employeeId: number;
    reportingManagerId?: number | null;
    secondReportingManagerId?: number | null;
  }> = [];

  if (Array.isArray(body?.employeeIds) && body.employeeIds.length > 0) {
    const { employeeIds, reportingManagerId, secondReportingManagerId } = body;
    updates = employeeIds.map((id: number) => ({
      employeeId: id,
      reportingManagerId: reportingManagerId !== undefined ? reportingManagerId : undefined,
      secondReportingManagerId: secondReportingManagerId !== undefined ? secondReportingManagerId : undefined,
    }));
  } else if (Array.isArray(body?.updates)) {
    updates = body.updates;
  } else {
    return NextResponse.json(
      { error: 'updates array or employeeIds array is required' },
      { status: 400 }
    );
  }

  for (const update of updates) {
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
        if (update.employeeId === update.reportingManagerId) {
          return NextResponse.json(
            { error: `An employee cannot report to themselves` },
            { status: 400 }
          );
        }
        if (await wouldCreateCycle(update.employeeId, update.reportingManagerId)) {
          return NextResponse.json(
            { error: `Cycle detected: assigning employee ${update.employeeId} to manager ${update.reportingManagerId} would create a reporting loop` },
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
      if (update.secondReportingManagerId !== null && update.employeeId === update.secondReportingManagerId) {
        return NextResponse.json(
          { error: `An employee cannot be their own second reporting manager` },
          { status: 400 }
        );
      }
      await prisma.employee.update({
        where: { id: update.employeeId },
        data: { secondReportingManagerId: update.secondReportingManagerId },
      });
    }
  }

  return NextResponse.json({
    message: `Successfully updated reporting assignment for ${updates.length} employee(s)`,
    count: updates.length,
  });
}
