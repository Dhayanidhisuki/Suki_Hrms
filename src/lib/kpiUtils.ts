/**
 * KPI statistics utilities — fetch module-specific metrics
 */

export interface ModuleStats {
  total: number;
  active?: number;
  inactive?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  custom?: Record<string, number | string>;
}

export async function fetchModuleStats(module: string): Promise<ModuleStats> {
  try {
    const res = await fetch(`/api/stats/${module}`);
    if (!res.ok) return { total: 0 };
    return await res.json();
  } catch {
    return { total: 0 };
  }
}

export async function fetchEmployeeStats(): Promise<ModuleStats> {
  return fetchModuleStats('employees');
}

export async function fetchDepartmentStats(): Promise<ModuleStats> {
  return fetchModuleStats('departments');
}

export async function fetchDesignationStats(): Promise<ModuleStats> {
  return fetchModuleStats('designations');
}

export async function fetchLeaveStats(): Promise<ModuleStats> {
  return fetchModuleStats('leaves');
}

export async function fetchAttendanceStats(): Promise<ModuleStats> {
  return fetchModuleStats('attendance');
}

export async function fetchPayrollStats(): Promise<ModuleStats> {
  return fetchModuleStats('payroll');
}

export async function fetchApprovalStats(): Promise<ModuleStats> {
  return fetchModuleStats('approvals');
}
