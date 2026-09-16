/**
 * GET /api/workforce/my-dashboard?year=YYYY&month=1-12
 *   One aggregate payload for the ESS dashboard page: profile card fields,
 *   today's attendance, the requested month's daily rows (for the flag
 *   chart) + monthly summary, missing/absent entry lists, leave balances,
 *   the employee's own pending request counts, pending approval counts
 *   (when the employee manages others), and the latest published payslip.
 *   Self-service: employeeId is resolved from the session, never taken
 *   from the client. year/month default to the current month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { resolveOwnEmployeeId, listAllReports } from '@/lib/reportingManager';

const TWO_STAGE_PENDING = ['pending_manager', 'pending_hr'];

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const ownEmployeeId = await resolveOwnEmployeeId(userId);
  if (!ownEmployeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const now = new Date();
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || now.getUTCFullYear();
  const month = Number(searchParams.get('month')) || now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1-12' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  const employee = await prisma.employee.findFirst({
    where: { id: ownEmployeeId, deletedAt: null },
    select: {
      employeeCode: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      lifecycleState: true,
      profilePhotoPath: true,
      officeEmail: true,
      company: { select: { name: true } },
      personalDetails: { select: { personalEmail: true } },
      contactDetails: { select: { presentMobile: true, permanentMobile: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        select: {
          joinDate: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          employeeType: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const daySelect = {
    id: true,
    date: true,
    status: true,
    inTime: true,
    outTime: true,
    workingMinutes: true,
    lateMinutes: true,
    earlyOutMinutes: true,
    otMinutesCalculated: true,
    otMinutesApproved: true,
    otApprovalStatus: true,
    shiftMaster: { select: { code: true, name: true } },
  } as const;

  const [
    monthDays,
    today,
    monthSummary,
    leaveBalances,
    reports,
    latestPayslip,
    reqLeave,
    reqMispunch,
    reqPermission,
    reqOnDuty,
    reqWfh,
    reqCompOff,
    reqShiftChange,
    reqLoan,
    reqExpense,
    reqEncashment,
  ] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: { employeeId: ownEmployeeId, date: { gte: monthStart, lt: monthEnd } },
      select: daySelect,
      orderBy: { date: 'asc' },
    }),
    prisma.dailyAttendance.findFirst({
      where: { employeeId: ownEmployeeId, date: { gte: todayStart, lt: todayEnd } },
      select: daySelect,
    }),
    prisma.monthlyAttendanceSummary.findUnique({
      where: { employeeId_year_month: { employeeId: ownEmployeeId, year, month } },
    }),
    prisma.leaveBalance.findMany({
      where: { employeeId: ownEmployeeId, year },
      include: { leaveMaster: { select: { id: true, code: true, name: true } } },
      orderBy: { leaveMaster: { name: 'asc' } },
    }),
    listAllReports(ownEmployeeId),
    prisma.payrollLine.findFirst({
      where: {
        employeeId: ownEmployeeId,
        payrollRun: { companyId: scope.companyId, status: { in: ['APPROVED', 'LOCKED'] } },
      },
      select: {
        id: true,
        netSalary: true,
        payrollRun: { select: { year: true, month: true } },
      },
      orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
    }),
    // Own pending request counts — "open" means still somewhere in the
    // approval pipeline, matching each module's status convention.
    prisma.leaveApplication.count({ where: { employeeId: ownEmployeeId, status: { in: TWO_STAGE_PENDING } } }),
    prisma.mispunchCorrection.count({ where: { employeeId: ownEmployeeId, status: { in: TWO_STAGE_PENDING } } }),
    prisma.permissionRequest.count({ where: { employeeId: ownEmployeeId, status: { in: TWO_STAGE_PENDING } } }),
    prisma.onDutyRequest.count({ where: { employeeId: ownEmployeeId, status: { in: TWO_STAGE_PENDING } } }),
    prisma.wfhRequest.count({ where: { employeeId: ownEmployeeId, status: { in: TWO_STAGE_PENDING } } }),
    prisma.compOffRequest.count({ where: { employeeId: ownEmployeeId, status: 'pending' } }),
    prisma.shiftChangeRequest.count({ where: { employeeId: ownEmployeeId, status: 'pending' } }),
    prisma.loan.count({ where: { employeeId: ownEmployeeId, status: 'pending' } }),
    prisma.expenseReimbursement.count({ where: { employeeId: ownEmployeeId, status: 'SUBMITTED' } }),
    prisma.leaveEncashmentRequest.count({ where: { employeeId: ownEmployeeId, status: 'SUBMITTED' } }),
  ]);

  // Pending approvals awaiting this employee as reporting manager (level 1
  // or 2 — listAllReports covers both). Zero for pure ICs.
  const reportIds = reports.map((r) => r.id);
  let approvals = { leave: 0, mispunch: 0, permission: 0, onDuty: 0, wfh: 0, ot: 0 };
  if (reportIds.length > 0) {
    const [aLeave, aMispunch, aPermission, aOnDuty, aWfh, aOt] = await Promise.all([
      prisma.leaveApplication.count({ where: { status: 'pending_manager', employeeId: { in: reportIds } } }),
      prisma.mispunchCorrection.count({ where: { status: 'pending_manager', employeeId: { in: reportIds } } }),
      prisma.permissionRequest.count({ where: { status: 'pending_manager', employeeId: { in: reportIds } } }),
      prisma.onDutyRequest.count({ where: { status: 'pending_manager', employeeId: { in: reportIds } } }),
      prisma.wfhRequest.count({ where: { status: 'pending_manager', employeeId: { in: reportIds } } }),
      prisma.dailyAttendance.count({ where: { otApprovalStatus: 'pending_manager', employeeId: { in: reportIds } } }),
    ]);
    approvals = { leave: aLeave, mispunch: aMispunch, permission: aPermission, onDuty: aOnDuty, wfh: aWfh, ot: aOt };
  }

  const job = employee.jobInfos[0];

  return NextResponse.json({
    profile: {
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      name: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' '),
      status: employee.status,
      lifecycleState: employee.lifecycleState,
      photoPath: employee.profilePhotoPath,
      email: employee.officeEmail ?? employee.personalDetails?.personalEmail ?? null,
      mobile: employee.contactDetails?.presentMobile ?? employee.contactDetails?.permanentMobile ?? null,
      company: employee.company?.name ?? null,
      joinDate: job?.joinDate ?? null,
      department: job?.department?.name ?? null,
      designation: job?.designation?.name ?? null,
      employeeType: job?.employeeType?.name ?? null,
      category: job?.category?.name ?? null,
    },
    today,
    month: { year, month, days: monthDays, summary: monthSummary },
    leaveBalances: leaveBalances.map((b) => ({
      leaveMasterId: b.leaveMasterId,
      code: b.leaveMaster.code,
      name: b.leaveMaster.name,
      opening: Number(b.openingBalance),
      accrued: Number(b.accrued),
      availed: Number(b.availed),
      carryForwardIn: Number(b.carryForwardIn),
      adjusted: Number(b.adjusted),
      total: Number(b.openingBalance) + Number(b.accrued) + Number(b.carryForwardIn) + Number(b.adjusted),
      used: Number(b.availed),
      available: Number(b.closingBalance),
      closing: Number(b.closingBalance),
      pendingApproval: Number(b.pendingApproval),
    })),
    requests: {
      leave: reqLeave,
      mispunch: reqMispunch,
      permission: reqPermission,
      onDuty: reqOnDuty,
      wfh: reqWfh,
      compOff: reqCompOff,
      shiftChange: reqShiftChange,
      loan: reqLoan,
      expense: reqExpense,
      encashment: reqEncashment,
    },
    approvals,
    isManager: reportIds.length > 0,
    latestPayslip,
  });
}
