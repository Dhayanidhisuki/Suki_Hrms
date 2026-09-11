import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generic function to count active/inactive for simple masters
async function countSimpleMaster(model: string) {
  try {
    const modelName = model as keyof typeof prisma;
    const table = prisma[modelName] as any;

    const total = await table.count();
    const active = await table.count({ where: { isActive: true, deletedAt: null } });
    const inactive = await table.count({ where: { isActive: false, deletedAt: null } });
    return { total: active + inactive, active, inactive, pending: 0, approved: 0, rejected: 0 };
  } catch (error) {
    console.error(`Error counting ${model}:`, error);
    return { total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 };
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const { module: moduleParam } = await params;
    const module = moduleParam.toLowerCase();

    let stats = { total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 };

    switch (module) {
      case 'employees': {
        const total = await prisma.employee.count();
        const active = await prisma.employee.count({ where: { isActive: true } });
        const inactive = await prisma.employee.count({ where: { isActive: false } });
        stats = { total, active, inactive, pending: 0, approved: 0, rejected: 0 };
        break;
      }

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

      case 'salary-components':
        stats = await countSimpleMaster('salaryComponent');
        break;

      case 'bonus-rates':
        stats = await countSimpleMaster('bonusRate');
        break;

      case 'esi-rates': {
        const total = await prisma.esiRate.count();
        const active = await prisma.esiRate.count({ where: { isActive: true } });
        const inactive = await prisma.esiRate.count({ where: { isActive: false } });
        stats = { total, active, inactive, pending: 0, approved: 0, rejected: 0 };
        break;
      }

      case 'pf-rates': {
        const total = await prisma.pfRate.count();
        const active = await prisma.pfRate.count({ where: { isActive: true } });
        const inactive = await prisma.pfRate.count({ where: { isActive: false } });
        stats = { total, active, inactive, pending: 0, approved: 0, rejected: 0 };
        break;
      }

      case 'tds-slabs':
        stats = await countSimpleMaster('tdsSlabs');
        break;

      case 'professional-tax-slabs':
        stats = await countSimpleMaster('professionalTaxSlabs');
        break;

      case 'gratuity-policies':
        stats = await countSimpleMaster('gratuityPolicy');
        break;

      case 'leaves': {
        const total = await prisma.leaveApplication.count();
        const approved = await prisma.leaveApplication.count({ where: { status: 'APPROVED' } });
        const pending = await prisma.leaveApplication.count({ where: { status: 'PENDING' } });
        const rejected = await prisma.leaveApplication.count({ where: { status: 'REJECTED' } });
        stats = { total, active: 0, inactive: 0, pending, approved, rejected };
        break;
      }

      case 'attendance': {
        const total = await prisma.dailyAttendance.count();
        const present = await prisma.dailyAttendance.count({ where: { status: 'PRESENT' } });
        const absent = await prisma.dailyAttendance.count({ where: { status: 'ABSENT' } });
        stats = { total, active: present, inactive: absent, pending: 0, approved: 0, rejected: 0 };
        break;
      }

      case 'payroll': {
        const total = await prisma.payrollRun.count();
        const processed = await prisma.payrollRun.count({ where: { status: { in: ['APPROVED', 'LOCKED'] } } });
        const pending = await prisma.payrollRun.count({ where: { status: { in: ['DRAFT', 'CALCULATED'] } } });
        stats = { total, active: processed, inactive: pending, pending, approved: processed, rejected: 0 };
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

      default:
        return NextResponse.json({ total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ total: 0, active: 0, inactive: 0, pending: 0, approved: 0, rejected: 0 });
  }
}
