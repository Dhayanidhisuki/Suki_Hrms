/**
 * Tab definitions for the combined Designations & Grades page. Plain module
 * (no 'use client') so both the server page and the client tab strip can import.
 */

export const EMPLOYEE_MASTER_TABS = [
  { key: 'designations', label: 'Designations', title: 'Designations', apiPath: '/api/masters/designations' },
  { key: 'grades', label: 'Grades', title: 'Grades', apiPath: '/api/masters/grades' },
] as const;

export type EmployeeMasterTabKey = (typeof EMPLOYEE_MASTER_TABS)[number]['key'];

export const EMPLOYEE_MASTERS_PATH = '/masters/designations-grades';

export function isEmployeeMasterTab(v: unknown): v is EmployeeMasterTabKey {
  return typeof v === 'string' && EMPLOYEE_MASTER_TABS.some((t) => t.key === v);
}
