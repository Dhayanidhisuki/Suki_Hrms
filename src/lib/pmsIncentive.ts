/**
 * Performance Incentive utilities — BRD rules, access decisions and
 * salary-basis lookup. Used by /api/payroll/pms/** and the page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { hasPermission } from './rbac';
import { getCompanyId } from './companyScope';
import { resolveOwnEmployeeId } from './reportingManager';
import type { PmsIncentiveConfig } from '@prisma/client';

export const PMS_MAX_COMPANY_PERCENT = 50;
export const PMS_MAX_INDIVIDUAL_PERCENT = 50;
export const PMS_MAX_TOTAL_PERCENT = 100;

export const PMS_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RETURNED: 'returned',
  FINALIZED: 'finalized',
} as const;

export interface PmsAccess {
  userId: number;
  companyId: number;
  roleId: number | null;
  ownEmployeeId: number | null;
  canViewAll: boolean;
  canManageConfig: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  isReportingManager: boolean;
}

export async function getPmsAccess(request: NextRequest): Promise<PmsAccess | NextResponse> {
  const userId = Number(request.headers.get('x-user-id'));
  const roleId = request.headers.get('x-role-id') ? Number(request.headers.get('x-role-id')) : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const [canView, canApprove, canManage, ownEmployeeId] = await Promise.all([
    roleId ? hasPermission(roleId, { module: 'payroll', submodule: 'pms', action: 'view' }) : Promise.resolve(false),
    roleId ? hasPermission(roleId, { module: 'payroll', submodule: 'pms', action: 'approve' }) : Promise.resolve(false),
    roleId ? hasPermission(roleId, { module: 'payroll', submodule: 'pms', action: 'approve' }) : Promise.resolve(false),
    resolveOwnEmployeeId(userId),
  ]);

  const directReports = ownEmployeeId
    ? await prisma.employee.count({ where: { reportingManagerId: ownEmployeeId, deletedAt: null, isActive: true } })
    : 0;

  // A reporting-manager login reaches the page if they have at least one
  // active direct report. HR/Admin reach it through the payroll.pms.view
  // permission.
  const canViewAll = canView;
  const isReportingManager = directReports > 0;
  if (!canViewAll && !isReportingManager) {
    return NextResponse.json({ error: 'Forbidden — you do not have access to Performance Incentive' }, { status: 403 });
  }

  return {
    userId,
    companyId: scope.companyId,
    roleId,
    ownEmployeeId,
    canViewAll,
    canManageConfig: canManage,
    canApprove,
    canSubmit: isReportingManager,
    isReportingManager,
  };
}

export async function getPmsConfig(companyId: number, financialYear?: string) {
  const where = financialYear
    ? { companyId, financialYear }
    : { companyId, status: 'active' };
  return prisma.pmsIncentiveConfig.findFirst({
    where,
    include: { salaryComponent: { select: { id: true, name: true, code: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export function toISODateInput(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function getFinancialYear(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

export function getDefaultPeriod(financialYear: string): { year: number; month: number; effectiveFrom: Date; effectiveTo: Date } {
  const [startYearStr] = financialYear.split('-');
  const startYear = Number(startYearStr);
  const from = new Date(startYear, 3, 1); // 1-Apr
  const to = new Date(startYear + 1, 2, 31); // 31-Mar
  return { year: from.getFullYear(), month: from.getMonth() + 1, effectiveFrom: from, effectiveTo: to };
}

export async function resolveBasisAmounts(
  employeeIds: number[],
  config: Pick<PmsIncentiveConfig, 'calculationBasis' | 'salaryComponentId' | 'targetIncentiveAmount'>
) {
  const [revisions, ctcs] = await Promise.all([
    prisma.employeeSalaryRevision.findMany({
      where: { employeeId: { in: employeeIds }, effectiveTo: null },
      include: {
        components: { include: { salaryComponent: { select: { id: true, code: true, name: true } } } },
      },
    }),
    prisma.employeeCtc.findMany({
      where: { employeeId: { in: employeeIds }, effectiveTo: null },
    }),
  ]);

  const revisionByEmployee = new Map(revisions.map((r) => [r.employeeId, r]));
  const ctcByEmployee = new Map(ctcs.map((c) => [c.employeeId, c]));
  const basisByEmployee = new Map<number, number>();

  for (const employeeId of employeeIds) {
    const rev = revisionByEmployee.get(employeeId);
    const ctc = ctcByEmployee.get(employeeId);
    let amount = 0;

    switch (config.calculationBasis) {
      case 'gross':
        amount = rev ? toNum(rev.grossSalary) : 0;
        break;
      case 'ctc':
        amount = ctc ? toNum(ctc.monthlyCtc) : 0;
        break;
      case 'target_incentive':
        amount = toNum(config.targetIncentiveAmount);
        break;
      case 'component':
        if (rev && config.salaryComponentId) {
          const comp = rev.components.find((c) => c.salaryComponentId === config.salaryComponentId);
          amount = comp ? toNum(comp.amount) : 0;
        }
        break;
      case 'basic':
      default:
        if (rev) {
          const basic =
            rev.components.find((c) => c.salaryComponent.code?.toUpperCase() === 'BASIC') ??
            rev.components.find((c) => c.salaryComponent.name?.toLowerCase().includes('basic'));
          amount = basic ? toNum(basic.amount) : toNum(rev.grossSalary);
        }
        break;
    }

    basisByEmployee.set(employeeId, amount);
  }

  return basisByEmployee;
}

export function toNum(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value === 'object' && 'toString' in value) return Number((value as { toString(): string }).toString()) || 0;
  return Number(value) || 0;
}

export function calculatePmsAmounts(
  basisAmount: number,
  config: { incentiveType: string; companyPercent: unknown; companyValue?: unknown | null },
  values: { companyPercent?: unknown | null; managerPercent?: unknown | null; companyValue?: unknown | null; individualValue?: unknown | null }
) {
  const companyPercent = values.companyPercent !== undefined && values.companyPercent !== null ? toNum(values.companyPercent) : toNum(config.companyPercent);
  const managerPercent = values.managerPercent !== undefined && values.managerPercent !== null ? toNum(values.managerPercent) : 0;
  const companyValue = values.companyValue !== undefined && values.companyValue !== null ? toNum(values.companyValue) : toNum(config.companyValue);
  const individualValue = toNum(values.individualValue);

  let companyAmount = 0;
  let individualAmount = 0;
  let totalPercent = 0;

  if (config.incentiveType === 'fixed') {
    companyAmount = companyValue;
    individualAmount = individualValue;
    totalPercent = 0;
  } else {
    companyAmount = (basisAmount * companyPercent) / 100;
    individualAmount = (basisAmount * managerPercent) / 100;
    totalPercent = companyPercent + managerPercent;
  }

  const overallAmount = companyAmount + individualAmount;

  return {
    companyPercent,
    managerPercent,
    totalPercent,
    companyAmount,
    individualAmount,
    overallAmount,
    basisAmount,
    companyValue,
    individualValue,
  };
}

/** Calendar days in the given month (Jan → 31). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * The fixed "Performance Incentive" salary component (code PERFORMANCE_INS)
 * from each employee's current salary revision — the payout base the BRD
 * formula prorates by present days.
 */
export async function resolvePerformanceIncentiveAmounts(employeeIds: number[], companyId: number) {
  const map = new Map<number, number>();
  if (employeeIds.length === 0) return map;
  const component = await prisma.salaryComponent.findFirst({
    where: { companyId, deletedAt: null, OR: [{ code: 'PERFORMANCE_INS' }, { name: 'Performance Incentive' }] },
    select: { id: true },
  });
  if (!component) return map;
  const revisions = await prisma.employeeSalaryRevision.findMany({
    where: { employeeId: { in: employeeIds }, effectiveTo: null },
    select: {
      employeeId: true,
      components: { where: { salaryComponentId: component.id }, select: { amount: true } },
    },
  });
  for (const r of revisions) map.set(r.employeeId, toNum(r.components[0]?.amount));
  return map;
}

/** presentDays per employee from MonthlyAttendanceSummary for a period. */
export async function resolvePresentDays(employeeIds: number[], year: number, month: number) {
  const map = new Map<number, number>();
  if (employeeIds.length === 0) return map;
  const rows = await prisma.monthlyAttendanceSummary.findMany({
    where: { employeeId: { in: employeeIds }, year, month },
    select: { employeeId: true, presentDays: true },
  });
  for (const r of rows) map.set(r.employeeId, toNum(r.presentDays));
  return map;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** BRD payout formula — see schema.prisma's PmsIncentive comment. */
export function computePmsMoney(
  performanceIncentive: number,
  monthDays: number,
  presentDays: number,
  totalPercent: number
) {
  const incentiveMoney = monthDays > 0 ? round2((performanceIncentive / monthDays) * presentDays) : 0;
  const incentiveEarn = round2((incentiveMoney * totalPercent) / 100);
  const employeeEsi = round2((incentiveEarn * 0.75) / 100);
  const employerEsi = round2((incentiveEarn * 3.25) / 100);
  const pmsNet = round2(incentiveEarn - employeeEsi);
  return { performanceIncentive, monthDays, presentDays, incentiveMoney, incentiveEarn, employeeEsi, employerEsi, pmsNet };
}

export async function canModifyEmployee(
  ownEmployeeId: number | null,
  employeeId: number,
  employee?: { reportingManagerId: number | null } | null
) {
  if (!ownEmployeeId) return false;
  const emp =
    employee ??
    (await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { reportingManagerId: true },
    }));
  return emp?.reportingManagerId === ownEmployeeId;
}
