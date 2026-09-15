/**
 * Department-wise weekly-off resolution.
 *
 * The admin configures which weekday(s) are off for each department via
 * DepartmentWeeklyOff. Department is a global master, so every lookup here
 * is company-scoped — without companyId, one company's configuration
 * silently applies to every other company's employees.
 *
 * Fallback: an employee whose department has no configuration at all, or
 * who has no department, is off on Sunday (day 0). This preserves the
 * behaviour from before the master existed.
 *
 * Callers that iterate employees × days must use buildWeeklyOffResolver —
 * it makes two queries total instead of three per (employee, day).
 */

import { prisma } from './prisma';

const SUNDAY = 0;

export type WeeklyOffResolver = {
  isWeeklyOff(employeeId: number, date: Date): boolean;
};

export async function buildWeeklyOffResolver(companyId: number, employeeIds: number[]): Promise<WeeklyOffResolver> {
  const departmentByEmployee = new Map<number, number | null>();
  const offDaysByDepartment = new Map<number, Set<number>>();

  if (employeeIds.length > 0) {
    const [jobInfos, configs] = await Promise.all([
      prisma.jobInfo.findMany({
        where: { employeeId: { in: employeeIds }, effectiveTo: null },
        select: { employeeId: true, departmentId: true },
      }),
      prisma.departmentWeeklyOff.findMany({
        where: { companyId },
        select: { departmentId: true, weekOffDay: true },
      }),
    ]);
    for (const j of jobInfos) departmentByEmployee.set(j.employeeId, j.departmentId ?? null);
    for (const c of configs) {
      let days = offDaysByDepartment.get(c.departmentId);
      if (!days) offDaysByDepartment.set(c.departmentId, (days = new Set()));
      days.add(c.weekOffDay);
    }
  }

  return {
    isWeeklyOff(employeeId, date) {
      const dayOfWeek = date.getUTCDay();
      const departmentId = departmentByEmployee.get(employeeId) ?? null;
      const configured = departmentId === null ? undefined : offDaysByDepartment.get(departmentId);
      if (!configured || configured.size === 0) return dayOfWeek === SUNDAY;
      return configured.has(dayOfWeek);
    },
  };
}

export async function isWeeklyOffForEmployee(companyId: number, employeeId: number, date: Date): Promise<boolean> {
  const resolver = await buildWeeklyOffResolver(companyId, [employeeId]);
  return resolver.isWeeklyOff(employeeId, date);
}

/** Configured weekly-off weekdays (0–6) for a department. Empty = no config, caller falls back to Sunday. */
export async function getDepartmentWeeklyOffDays(companyId: number, departmentId: number): Promise<number[]> {
  const configs = await prisma.departmentWeeklyOff.findMany({
    where: { companyId, departmentId },
    select: { weekOffDay: true },
  });
  return configs.map((c) => c.weekOffDay);
}

/** True if the date is a declared holiday or a yearly leave calendar entry for the company. */
export async function isHolidayOrYearlyLeave(companyId: number, date: Date): Promise<boolean> {
  const holiday = await prisma.holidayMaster.findFirst({
    where: { companyId, date, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (holiday) return true;

  const yearlyLeave = await prisma.yearlyLeaveCalendar.findFirst({
    where: { companyId, date, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return yearlyLeave !== null;
}
