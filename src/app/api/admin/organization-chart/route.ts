/**
 * GET /api/admin/organization-chart
 *
 * Returns the org chart tree for the company — same hierarchy as the
 * reporting structure, but with aggregate stats per node (headcount of
 * all direct + indirect reports, total salary cost).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { listAllReports } from '@/lib/reportingManager';

interface OrgNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
  grossSalary: number | null;
  headcount: number;
  totalSalaryCost: number;
  children: OrgNode[];
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
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          designation: { select: { name: true } },
          department: { select: { name: true } },
          currentSalaryRevision: { select: { grossSalary: true } },
        },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  // Build map: managerId -> children
  const byManager = new Map<number | null, typeof employees>();
  for (const emp of employees) {
    const mgrId = emp.reportingManagerId ?? null;
    if (!byManager.has(mgrId)) byManager.set(mgrId, []);
    byManager.get(mgrId)!.push(emp);
  }

  // Cache for all-reports headcount/salary to avoid O(n^2) queries
  const headcountCache = new Map<number, { headcount: number; salaryCost: number }>();

  async function computeStats(managerId: number): Promise<{ headcount: number; salaryCost: number }> {
    if (headcountCache.has(managerId)) return headcountCache.get(managerId)!;
    const reports = await listAllReports(managerId);
    let salaryCost = 0;
    for (const r of reports) {
      const emp = employees.find((e) => e.id === r.id);
      const gross = emp?.jobInfos[0]?.currentSalaryRevision?.grossSalary;
      if (gross) salaryCost += Number(gross);
    }
    const result = { headcount: reports.length, salaryCost };
    headcountCache.set(managerId, result);
    return result;
  }

  async function buildNode(managerId: number | null): Promise<OrgNode[]> {
    const children = byManager.get(managerId) ?? [];
    const nodes: OrgNode[] = [];
    for (const emp of children) {
      const stats = await computeStats(emp.id);
      nodes.push({
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        designation: emp.jobInfos[0]?.designation?.name ?? null,
        department: emp.jobInfos[0]?.department?.name ?? null,
        grossSalary: emp.jobInfos[0]?.currentSalaryRevision?.grossSalary
          ? Number(emp.jobInfos[0].currentSalaryRevision.grossSalary)
          : null,
        headcount: stats.headcount,
        totalSalaryCost: stats.salaryCost,
        children: await buildNode(emp.id),
      });
    }
    return nodes;
  }

  const tree = await buildNode(null);
  return NextResponse.json({ data: tree });
}
