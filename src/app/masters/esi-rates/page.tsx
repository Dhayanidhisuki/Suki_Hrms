'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. ESI-2026' },
  { name: 'employeeContributionRate', label: 'Employee Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
  { name: 'employerContributionRate', label: 'Employer Rate %', type: 'number', required: true, step: '0.01', min: 0, max: 100 },
  { name: 'wageCeilingMonthly', label: 'Wage Ceiling (Monthly)', type: 'number', required: true, step: '0.01', min: 0 },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

const columns: Column<{ id: number; code: string; employeeContributionRate: number; employerContributionRate: number; wageCeilingMonthly: number; effectiveFrom: string; effectiveTo: string | null; isActive: boolean }>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'employeeContributionRate', label: 'Emp Rate %', render: (row) => `${row.employeeContributionRate}%` },
  { key: 'employerContributionRate', label: 'Empr Rate %', render: (row) => `${row.employerContributionRate}%` },
  { key: 'wageCeilingMonthly', label: 'Wage Ceiling' },
];

export default function EsiRatesPage() {
  return <SlabPage title="ESI Rates" apiPath="/api/masters/esi-rates" fields={fields} columns={columns} itemLabel="ESI Rate" />;
}
