/**
 * GET /api/stats/[module] — headline counts for the dashboard KPI cards.
 *
 * Two rules this route has to honour, because the numbers it returns are
 * company-wide HR figures:
 *
 *  1. Permission. Each stats module maps to the permission module that owns
 *     the underlying data (employees → "employee", payroll → "payroll", …).
 *     A role holding nothing in that module gets a 403 — that's what keeps
 *     an ESS-only employee from reading headcount and payroll totals.
 *  2. Company scope. companyId comes from the verified JWT via getCompanyId,
 *     never from the request. Records that carry companyId are filtered on
 *     it; DailyAttendance has no companyId column of its own, so it scopes
 *     through its employee. The org/statutory masters (departments, PF/ESI
 *     rates, …) are global tables with no companyId at all — they stay
 *     unscoped because there is nothing to scope them by.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAnyPermissionInModule } from '@/lib/rbac';
import { getCompanyId } from '@/lib/companyScope';

const EMPTY = { total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 };

/**
 * stats module → the permission module that owns that data. Anything not
 * listed here is an unknown module and 404s before any query runs.
 */
const MODULE_PERMISSION: Record<string, string> = {
  employees: 'employee',
  'jd-master': 'employee',
  departments: 'masters',
  designations: 'masters',
  grades: 'masters',
  levels: 'masters',
  categories: 'masters',
  'employee-types': 'masters',
  'asset-masters': 'masters',
  'loan-types': 'masters',
  'leave-masters': 'masters',
  'salary-components': 'masters',
  'bonus-rates': 'masters',
  'esi-rates': 'masters',
  'pf-rates': 'masters',
  'tds-slabs': 'masters',
  'professional-tax-slabs': 'masters',
  'gratuity-policies': 'masters',
  leaves: 'workforce',
  attendance: 'workforce',
  approvals: 'workforce',
  payroll: 'payroll',
};

/**
 * Counts for a global master — these tables have no companyId column, so
 * there is no tenant filter to apply.
 */
async function countSimpleMaster(model: string) {
  try {
    // Model is chosen at runtime; only .count is called on it.
    const table = prisma[model as keyof typeof prisma] as unknown as {
      count(args?: object): Promise<number>;
    };
    const [active, inactive] = await Promise.all([
      table.count({ where: { isActive: true, deletedAt: null } }),
      table.count({ where: { isActive: false, deletedAt: null } }),
    ]);
    return { ...EMPTY, total: active + inactive, active, inactive };
  } catch (error) {
    console.error(`Error counting ${model}:`, error);
    return { ...EMPTY };
  }
}

/** Counts for a company-scoped master that carries isActive/deletedAt. */
async function countScopedMaster(model: string, companyId: number) {
  try {
    // Model is chosen at runtime; only .count is called on it.
    const table = prisma[model as keyof typeof prisma] as unknown as {
      count(args?: object): Promise<number>;
    };
    const [active, inactive] = await Promise.all([
      table.count({ where: { companyId, isActive: true, deletedAt: null } }),
      table.count({ where: { companyId, isActive: false, deletedAt: null } }),
    ]);
    return { ...EMPTY, total: active + inactive, active, inactive };
  } catch (error) {
    console.error(`Error counting ${model}:`, error);
    return { ...EMPTY };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const { module: moduleParam } = await params;
    const module = moduleParam.toLowerCase();

    const permissionModule = MODULE_PERMISSION[module];
    if (!permissionModule) {
      return NextResponse.json({ error: 'Unknown stats module' }, { status: 404 });
    }

    const roleId = request.headers.get('x-role-id');
    if (!roleId) {
      return NextResponse.json(
        { error: 'Unauthorized — authentication required' },
        { status: 401 }
      );
    }

    const allowed = await hasAnyPermissionInModule(Number(roleId), permissionModule);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Forbidden — insufficient permissions',
          required: `${permissionModule}.*`,
          roleId: Number(roleId),
        },
        { status: 403 }
      );
    }

    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const { companyId } = scope;

    let stats = { ...EMPTY };

    switch (module) {
      case 'employees': {
        const [active, inactive] = await Promise.all([
          prisma.employee.count({ where: { companyId, isActive: true, deletedAt: null } }),
          prisma.employee.count({ where: { companyId, isActive: false, deletedAt: null } }),
        ]);
        stats = { ...EMPTY, total: active + inactive, active, inactive };
        break;
      }

      case 'jd-master': {
        // JobDescription is a global table (no companyId column).
        const [total, withFile] = await Promise.all([
          prisma.jobDescription.count({ where: { deletedAt: null } }),
          prisma.jobDescription.count({
            where: { deletedAt: null, jdFileUrl: { not: null } },
          }),
        ]);
        stats = { ...EMPTY, total, active: withFile };
        break;
      }

      // ── Global masters — no companyId column to scope by ──────────────────
      case 'departments':
        stats = await countSimpleMaster('department');
        break;
      case 'designations':
        stats = await countSimpleMaster('designation');
        break;
      case 'grades':
        stats = await countSimpleMaster('grade');
        break;
      case 'levels':
        stats = await countSimpleMaster('level');
        break;
      case 'categories':
        stats = await countSimpleMaster('category');
        break;
      case 'employee-types':
        stats = await countSimpleMaster('employeeType');
        break;
      case 'asset-masters':
        stats = await countSimpleMaster('assetMaster');
        break;
      case 'loan-types':
        stats = await countSimpleMaster('loanType');
        break;
      case 'leave-masters':
        stats = await countSimpleMaster('leaveMaster');
        break;
      case 'tds-slabs':
        stats = await countSimpleMaster('tdsSlabs');
        break;
      case 'professional-tax-slabs':
        stats = await countSimpleMaster('professionalTaxSlabs');
        break;

      case 'esi-rates': {
        const [active, inactive] = await Promise.all([
          prisma.esiRate.count({ where: { isActive: true } }),
          prisma.esiRate.count({ where: { isActive: false } }),
        ]);
        stats = { ...EMPTY, total: active + inactive, active, inactive };
        break;
      }

      case 'pf-rates': {
        const [active, inactive] = await Promise.all([
          prisma.pfRate.count({ where: { isActive: true } }),
          prisma.pfRate.count({ where: { isActive: false } }),
        ]);
        stats = { ...EMPTY, total: active + inactive, active, inactive };
        break;
      }

      // ── Company-scoped masters ────────────────────────────────────────────
      case 'salary-components':
        stats = await countScopedMaster('salaryComponent', companyId);
        break;
      case 'bonus-rates':
        stats = await countScopedMaster('bonusRate', companyId);
        break;
      case 'gratuity-policies':
        stats = await countScopedMaster('gratuityPolicy', companyId);
        break;

      // ── Transactional data ────────────────────────────────────────────────
      case 'leaves':
      case 'approvals': {
        const [total, pending, approved, rejected] = await Promise.all([
          prisma.leaveApplication.count({ where: { companyId } }),
          prisma.leaveApplication.count({ where: { companyId, status: 'PENDING' } }),
          prisma.leaveApplication.count({ where: { companyId, status: 'APPROVED' } }),
          prisma.leaveApplication.count({ where: { companyId, status: 'REJECTED' } }),
        ]);
        stats = { ...EMPTY, total, pending, approved, rejected };
        break;
      }

      case 'attendance': {
        // No companyId column — scope through the owning employee.
        const inCompany = { employee: { companyId } };
        const [total, present, absent] = await Promise.all([
          prisma.dailyAttendance.count({ where: inCompany }),
          prisma.dailyAttendance.count({ where: { ...inCompany, status: 'PRESENT' } }),
          prisma.dailyAttendance.count({ where: { ...inCompany, status: 'ABSENT' } }),
        ]);
        stats = { ...EMPTY, total, active: present, inactive: absent };
        break;
      }

      case 'payroll': {
        const [total, processed, pending] = await Promise.all([
          prisma.payrollRun.count({ where: { companyId } }),
          prisma.payrollRun.count({
            where: { companyId, status: { in: ['APPROVED', 'LOCKED'] } },
          }),
          prisma.payrollRun.count({
            where: { companyId, status: { in: ['DRAFT', 'CALCULATED'] } },
          }),
        ]);
        stats = { ...EMPTY, total, active: processed, inactive: pending, pending, approved: processed };
        break;
      }

      case 'approvals': {
        const total = await prisma.leaveApplication.count({
          where: { OR: [{ status: 'PENDING' }, { status: 'APPROVED' }, { status: 'REJECTED' }] },
        });
        const pending = await prisma.leaveApplication.count({ where: { status: 'PENDING' } });
        const approved = await prisma.leaveApplication.count({ where: { status: 'APPROVED' } });
        const rejected = await prisma.leaveApplication.count({ where: { status: 'REJECTED' } });
        stats = { total, active: 0, inactive: 0, pending, approved, rejected };
        break;
      }

      case 'skill-levels':
        stats = await countSimpleMaster('skillLevel');
        break;

      case 'competencies':
        stats = await countSimpleMaster('competency');
        break;

      case 'skill-matrix':
        stats = await countSimpleMaster('employeeCompetency');
        break;

      case 'training-plan':
        stats = await countSimpleMaster('trainingPlan');
        break;

      case 'training-calendar':
        stats = await countSimpleMaster('trainingSchedule');
        break;

      case 'training-needs': {
        const total = await prisma.trainingNeedRequest.count({ where: { deletedAt: null } });
        const pending = await prisma.trainingNeedRequest.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'SUBMITTED'] } } });
        const approved = await prisma.trainingNeedRequest.count({ where: { deletedAt: null, status: 'APPROVED' } });
        const rejected = await prisma.trainingNeedRequest.count({ where: { deletedAt: null, status: 'REJECTED' } });
        stats = { total, active: approved, inactive: rejected, pending, approved, rejected };
        break;
      }

      case 'training-nominations': {
        const total = await prisma.trainingNomination.count({ where: { deletedAt: null } });
        const pending = await prisma.trainingNomination.count({ where: { deletedAt: null, status: 'PENDING' } });
        const approved = await prisma.trainingNomination.count({ where: { deletedAt: null, status: 'APPROVED' } });
        const rejected = await prisma.trainingNomination.count({ where: { deletedAt: null, status: 'REJECTED' } });
        stats = { total, active: approved, inactive: rejected, pending, approved, rejected };
        break;
      }

      default:
        return NextResponse.json({ total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ ...EMPTY });
  }
}
