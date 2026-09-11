'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. LWF-MH', helpText: 'Unique code for this LWF rate' },
  { name: 'state', label: 'State', type: 'text', required: true, placeholder: 'e.g. Maharashtra' },
  { name: 'employeeRate', label: 'Employee Rate', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Flat amount or % of gross (per rate type)' },
  { name: 'employerRate', label: 'Employer Rate', type: 'number', required: true, step: '0.01', min: 0 },
  { name: 'rateType', label: 'Rate Type', type: 'select', required: true, defaultValue: 'FLAT', options: [
    { label: 'Flat Amount', value: 'FLAT' },
    { label: 'Percent of Gross', value: 'PERCENT' },
  ] },
  { name: 'frequency', label: 'Frequency', type: 'select', required: true, defaultValue: 'MONTHLY', options: [
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Half-Yearly', value: 'HALF_YEARLY' },
    { label: 'Yearly', value: 'YEARLY' },
  ] },
  { name: 'deductionMonth', label: 'Deduction Month', type: 'number', required: true, min: 1, max: 12, defaultValue: 1, helpText: 'For half-yearly/yearly: which month (1-12) to deduct' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface LwfRateRow {
  id: number;
  code: string; // SlabPage requires this field; we use state as the code
  state: string;
  employeeRate: number;
  employerRate: number;
  rateType: string;
  frequency: string;
  deductionMonth: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<LwfRateRow>[] = [
  { key: 'state', label: 'State', sortable: true, className: 'font-medium' },
  { key: 'employeeRate', label: 'Employee Rate' },
  { key: 'employerRate', label: 'Employer Rate' },
  { key: 'rateType', label: 'Type' },
  { key: 'frequency', label: 'Frequency' },
];

export default function LwfRatesPage() {
  return (
    <SlabPage<LwfRateRow>
      statsModule="lwf-rates"
      title="LWF Rates"
      apiPath="/api/masters/lwf-rates"
      fields={fields}
      columns={columns}
      itemLabel="LWF Rate"
    />
  );
}
