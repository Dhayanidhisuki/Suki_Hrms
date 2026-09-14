/**
 * Phase TimeOffice — helpers for department-wise weekly off detection.
 *
 * The admin configures which day(s) of the week are weekly off for each
 * department via DepartmentWeeklyOff. These helpers resolve that config
 * for a given employee/date, replacing the old hardcoded Sunday check.
 */

import { prisma } from './prisma';

/**
 * Returns true if the given date is a weekly off day for the employee's
 * department. Falls back to Sunday (day 0) when no DepartmentWeeklyOff
 * config exists for the employee's department — preserves backward
 * compatibility.
 */
export async function isWeeklyOffForEmployee(employeeId: number, date: Date): Promise<boolean> {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Find the employee's current department via JobInfo
  const jobInfo = await prisma.jobInfo.findFirst({
    where: { employeeId, effectiveTo: null },
    select: { departmentId: true },
  });

  if (!jobInfo?.departmentId) {
    // No department assigned — fall back to Sunday
    return dayOfWeek === 0;
  }

  // Check if this day is configured as a weekly off for the department
  const weeklyOff = await prisma.departmentWeeklyOff.findUnique({
    where: {
      departmentId_weekOffDay: {
        departmentId: jobInfo.departmentId,
        weekOffDay: dayOfWeek,
      },
    },
  });

  if (weeklyOff) {
    return true;
  }

  // If the department has ANY weekly off configured, use only those days.
  // If the department has NO weekly off configured, fall back to Sunday.
  const anyConfig = await prisma.departmentWeeklyOff.findFirst({
    where: { departmentId: jobInfo.departmentId },
  });

  return !anyConfig && dayOfWeek === 0;
}

/**
 * Returns the configured weekly off days (0-6) for a department.
 * Empty array means no config — caller should fall back to Sunday.
 */
export async function getDepartmentWeeklyOffDays(departmentId: number): Promise<number[]> {
  const configs = await prisma.departmentWeeklyOff.findMany({
    where: { departmentId },
    select: { weekOffDay: true },
  });
  return configs.map((c) => c.weekOffDay);
}

/**
 * Returns true if the given date is a declared holiday (HolidayMaster)
 * OR a yearly leave calendar entry for the employee's company.
 */
export async function isHolidayOrYearlyLeave(companyId: number, date: Date): Promise<boolean> {
  const holiday = await prisma.holidayMaster.findFirst({
    where: { companyId, date, isActive: true, deletedAt: null },
  });
  if (holiday) return true;

  const yearlyLeave = await prisma.yearlyLeaveCalendar.findFirst({
    where: { companyId, date, isActive: true, deletedAt: null },
  });
  if (yearlyLeave) return true;

  return false;
}
