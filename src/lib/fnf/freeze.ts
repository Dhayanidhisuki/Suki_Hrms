import { prisma } from '@/lib/prisma';
import type { FnFFreezeContent, FnFFreezeComponent } from '@/lib/fnf/types';
import {
  attendanceUnits,
  bonusOnEarnedBasic,
  calendarDaysInMonth,
  earnedBasic,
  periodStartAfterPayroll,
  pickSalaryRevisionAsOf,
  resolveDivisor,
  sumAttendanceUnits,
  unpaidPayableDays,
} from '@/lib/fnf/rules';

function fyStartYear(lwd: Date, fyStartMonth: number): number {
  const m = lwd.getUTCMonth() + 1;
  const y = lwd.getUTCFullYear();
  return m >= fyStartMonth ? y : y - 1;
}

export async function gatherFnfFreeze(employeeId: number, exitInterviewId: number, companyId: number): Promise<FnFFreezeContent> {
  const [config, exitInterview, employee, tdsCfg] = await Promise.all([
    prisma.fullAndFinalConfig.findUnique({ where: { companyId } }),
    prisma.exitInterview.findUnique({ where: { id: exitInterviewId } }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        jobInfos: { where: { effectiveTo: null }, take: 1, include: { designation: true, department: true } },
      },
    }),
    prisma.tdsRegimeConfig.findUnique({ where: { companyId } }),
  ]);
  if (!employee) throw new Error(`Employee ${employeeId} not found`);
  if (!exitInterview) throw new Error(`ExitInterview ${exitInterviewId} not found`);

  const lastWorkingDay = exitInterview.approvedLastWorkingDay ?? exitInterview.exitDate;
  const lastPayrollLine = await prisma.payrollLine.findFirst({
    where: { employeeId, payrollRun: { companyId, status: { in: ['APPROVED', 'LOCKED', 'POSTED'] } } },
    include: { payrollRun: true },
    orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }],
  });
  const lastPayroll = lastPayrollLine
    ? {
        year: lastPayrollLine.payrollRun.year,
        month: lastPayrollLine.payrollRun.month,
        gross: Number(lastPayrollLine.grossEarnings),
        tds: Number(lastPayrollLine.tds),
        pf: Number(lastPayrollLine.pfEmployee),
        esi: Number(lastPayrollLine.esiEmployee),
        pt: Number(lastPayrollLine.professionalTax),
        status: lastPayrollLine.payrollRun.status,
      }
    : null;

  const revisions = await prisma.employeeSalaryRevision.findMany({
    where: { employeeId },
    include: { components: { include: { salaryComponent: true } } },
    orderBy: { effectiveFrom: 'desc' },
  });
  const asOf = pickSalaryRevisionAsOf(revisions, lastWorkingDay);
  const components: FnFFreezeComponent[] = (asOf?.components ?? []).map((c) => ({
    salaryComponentId: c.salaryComponentId,
    code: c.salaryComponent.code,
    name: c.salaryComponent.name,
    type: c.salaryComponent.type,
    amount: Number(c.amount),
    includeInGross: c.salaryComponent.includeInGross,
    includeInPf: c.salaryComponent.includeInPf,
    fnfPayable: c.salaryComponent.fnfPayable,
    fnfProration: c.salaryComponent.fnfProration,
    fnfTaxable: c.salaryComponent.fnfTaxable,
  }));

  const periodStart = periodStartAfterPayroll(lastWorkingDay, lastPayroll);
  const attendance = await prisma.dailyAttendance.findMany({
    where: { employeeId, date: { gte: periodStart, lte: lastWorkingDay } },
    select: { date: true, status: true },
  });
  const attendanceDays = attendance.map((a) => ({
    date: a.date.toISOString().slice(0, 10),
    status: a.status,
    units: attendanceUnits(a.status),
  }));
  const attUnits = sumAttendanceUnits(attendanceDays);
  const calendarFallback = unpaidPayableDays(lastWorkingDay, lastPayroll);
  const payableDays = attendanceDays.length > 0 ? attUnits : calendarFallback;

  const lwdMonthDays = calendarDaysInMonth(lastWorkingDay.getUTCFullYear(), lastWorkingDay.getUTCMonth() + 1);
  const lastSalaryMonthDays = lastPayroll
    ? calendarDaysInMonth(lastPayroll.year, lastPayroll.month)
    : lwdMonthDays;
  const workingInMonth = attendanceDays.filter((d) => d.units > 0).length || lwdMonthDays;
  const salaryDivisor = resolveDivisor(
    config?.salaryDivisorMode ?? 'CALENDAR',
    lwdMonthDays,
    workingInMonth,
    config?.salaryDivisor ?? lastSalaryMonthDays,
  );

  const leaveBalances = await prisma.leaveBalance.findMany({
    where: { employeeId, leaveMaster: { deletedAt: null } },
    include: { leaveMaster: true },
  });
  const leave = leaveBalances.map((b) => {
    const code = (b.leaveMaster?.code ?? '').toUpperCase();
    return {
      typeCode: code,
      closingBalance: Number(b.closingBalance),
      encashable: code === 'EL' || code === 'PL' || code === 'EL/PL',
    };
  });

  const gratuityRecord = await prisma.gratuityRecord.findFirst({
    where: { employeeId, status: { in: ['CALCULATED', 'APPROVED', 'PAID'] } },
  });
  const bonusRecord = await prisma.bonusRecord.findFirst({
    where: { employeeId, status: { in: ['CALCULATED', 'APPROVED', 'PROCESSED'] }, bonusAmount: { not: null } },
    orderBy: { acYear: 'desc' },
  });
  const bonusRate = await prisma.bonusRate.findFirst({
    where: { companyId, isActive: true, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
  const bonusRatePercent = Number(bonusRate?.ratePercent ?? 8.33);

  const fyMonth = tdsCfg?.financialYearStart ?? 4;
  const fyYear = fyStartYear(lastWorkingDay, fyMonth);
  const fyStart = new Date(Date.UTC(fyYear, fyMonth - 1, 1));
  const fyAtt = await prisma.dailyAttendance.findMany({
    where: { employeeId, date: { gte: fyStart, lte: lastWorkingDay } },
    select: { date: true, status: true },
  });
  let bonusEarnedBasic = 0;
  for (
    let cursor = new Date(fyStart);
    cursor <= lastWorkingDay;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const payDays = calendarDaysInMonth(y, m);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 0));
    const cap = monthEnd < lastWorkingDay ? monthEnd : lastWorkingDay;
    const present = sumAttendanceUnits(
      fyAtt
        .filter((a) => a.date >= monthStart && a.date <= cap)
        .map((a) => ({ status: a.status })),
    );
    const asOfMonth = pickSalaryRevisionAsOf(revisions, cap);
    const theoretical =
      asOfMonth?.components
        .filter((c) => c.salaryComponent.code === 'BASIC')
        .reduce((s, c) => s + Number(c.amount), 0) ?? Number(asOfMonth?.grossSalary ?? 0);
    const presentOrFull = fyAtt.some((a) => a.date >= monthStart && a.date <= cap)
      ? present
      : Math.min(payDays, cap.getUTCDate());
    bonusEarnedBasic += earnedBasic(theoretical, presentOrFull, payDays);
  }
  const computedBonus = bonusOnEarnedBasic(bonusEarnedBasic, bonusRatePercent);
  const bonusPaidOutside = bonusRecord?.status === 'PROCESSED';
  const arrears = await prisma.salaryArrear.findMany({ where: { employeeId, companyId, status: 'CALCULATED' } });
  const loans = await prisma.loan.findMany({
    where: { employeeId, status: { in: ['active', 'approved', 'disbursed'] } },
  });
  const assets = await prisma.employeeAssetAllocation.findMany({
    where: { employeeId, returnedDate: null },
  });

  const fyEnd = new Date(Date.UTC(fyYear + 1, fyMonth - 1, 1));
  const tdsLines = await prisma.payrollLine.findMany({
    where: { employeeId, payrollRun: { companyId, status: { in: ['APPROVED', 'LOCKED', 'POSTED'] } } },
    include: { payrollRun: true },
  });
  let grossYtd = 0;
  let tdsYtd = 0;
  for (const line of tdsLines) {
    const runDate = new Date(Date.UTC(line.payrollRun.year, line.payrollRun.month - 1, 1));
    if (runDate >= fyStart && runDate < fyEnd) {
      grossYtd += Number(line.grossEarnings);
      tdsYtd += Number(line.tds);
    }
  }

  const noticeRequired = exitInterview.noticePeriodDays ?? config?.noticePeriodDays ?? 30;
  let served = exitInterview.noticeServedDays ?? 0;
  if (!served && exitInterview.interviewDate) {
    served = Math.max(0, Math.ceil((lastWorkingDay.getTime() - exitInterview.interviewDate.getTime()) / 86_400_000));
  }

  return {
    frozenAt: new Date().toISOString(),
    employeeId,
    exitInterviewId,
    lastWorkingDay: lastWorkingDay.toISOString(),
    exitType: exitInterview.exitType,
    noticeRequired,
    noticeServedDays: served,
    noticeWaivedDays: exitInterview.noticeWaivedDays ?? 0,
    salaryDivisor,
    salaryDivisorMode: config?.salaryDivisorMode ?? 'CALENDAR',
    noticeRateBasis: config?.noticeRateBasis ?? 'GROSS',
    periodStart: periodStart.toISOString(),
    lastPayroll,
    salaryAsOfLwd: {
      revisionId: asOf?.id ?? null,
      grossSalary: asOf ? Number(asOf.grossSalary) : lastPayroll?.gross ?? 0,
      components,
    },
    attendanceDays,
    payableDays,
    leave,
    leaveEncashment: {
      denominator: lastSalaryMonthDays,
      basis: 'BASIC',
      maxDays: null,
      includeEarnedOnly: true,
    },
    gratuity: Number(gratuityRecord?.payableGratuity ?? gratuityRecord?.grossGratuity ?? 0),
    gratuityPaidOutside: gratuityRecord?.status === 'PAID',
    bonus: computedBonus,
    bonusPaidOutside,
    bonusRatePercent,
    bonusEarnedBasic,
    arrears: arrears.reduce((s, a) => s + Number(a.netArrearTotal), 0),
    incentive: 0,
    incentivePaidOutside: true,
    loans: loans.map((l) => ({ id: l.id, outstanding: Number(l.outstandingBalance) })),
    assets: assets.map((a) => ({ id: a.id, value: Number(a.assetValue ?? 0) })),
    tdsYtd: { financialYear: fyYear, grossYtd, tdsYtd },
    config: {
      includeUnpaidSalary: config?.includeUnpaidSalary !== false,
      includeLeaveEncashment: config?.includeLeaveEncashment !== false,
      includeGratuity: config?.includeGratuity !== false,
      includeBonusProportion: config?.includeBonusProportion !== false,
      includeNoticePay: config?.includeNoticePay !== false,
      includeLoanRecovery: config?.includeLoanRecovery !== false,
      includeAssetRecovery: config?.includeAssetRecovery !== false,
      includeTds: config?.includeTds !== false,
      includePf: config?.includePf !== false,
      includeEsi: config?.includeEsi !== false,
      includePt: config?.includePt !== false,
      clearanceRequired: config?.clearanceRequired !== false,
    },
  };
}
