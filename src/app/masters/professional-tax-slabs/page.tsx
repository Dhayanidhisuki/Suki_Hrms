'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. PT-NEW' },
  { name: 'minSalary', label: 'Min Salary', type: 'number', required: true, step: '0.01', min: 0 },
  { name: 'maxSalary', label: 'Max Salary', type: 'number', step: '0.01', min: 0, helpText: 'Leave blank for no upper limit' },
  { name: 'monthlyAmount', label: 'Monthly Amount', type: 'number', required: true, step: '0.01', min: 0 },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

const columns: Column<{ id: number; code: string; minSalary: number; maxSalary: number | null; monthlyAmount: number; effectiveFrom: string; effectiveTo: string | null; isActive: boolean }>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'minSalary', label: 'Min Salary' },
  { key: 'maxSalary', label: 'Max Salary', render: (row) => row.maxSalary ?? 'No limit' },
  { key: 'monthlyAmount', label: 'Monthly Amount' },
];

export default function ProfessionalTaxSlabsPage() {
  return <SlabPage title="Professional Tax Slabs" apiPath="/api/masters/professional-tax-slabs" fields={fields} columns={columns} itemLabel="PT Slab" />;
}
