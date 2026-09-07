'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. BONUS-2026' },
  {
    name: 'calculationType',
    label: 'Calculation Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Basic Projection (min(Basic, ceiling) × 12 × rate%)', value: 'BASIC_PROJECTION' },
      { label: 'Actual Net Pay (sum of real monthly net pay × rate%)', value: 'ACTUAL_NET_PAY' },
    ],
    helpText: 'Which formula bonusCalculation.ts uses for this company',
  },
  { name: 'ratePercent', label: 'Rate %', type: 'number', required: true, step: '0.01', min: 8.33, max: 100, helpText: 'Cannot be below the statutory minimum, 8.33%' },
  { name: 'minRatePercent', label: 'Min Rate %', type: 'number', required: true, step: '0.01', min: 8.33, max: 100 },
  { name: 'maxRatePercent', label: 'Max Rate %', type: 'number', required: true, step: '0.01', min: 8.33, max: 100 },
  { name: 'wageEligibilityCeiling', label: 'Wage Eligibility Ceiling', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Monthly wage must be ≤ this to be eligible' },
  { name: 'calculationWageCeiling', label: 'Calculation Wage Ceiling', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Basic Projection only — wage basis capped at this' },
  { name: 'minWorkingDays', label: 'Min Working Days', type: 'number', required: true, min: 0, defaultValue: 30 },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface BonusRateRow {
  id: number;
  code: string;
  calculationType: string;
  ratePercent: number;
  minRatePercent: number;
  maxRatePercent: number;
  wageEligibilityCeiling: number;
  calculationWageCeiling: number;
  minWorkingDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<BonusRateRow>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'calculationType', label: 'Type', render: (row) => (row.calculationType === 'ACTUAL_NET_PAY' ? 'Actual Net Pay' : 'Basic Projection') },
  { key: 'ratePercent', label: 'Rate %', render: (row) => `${row.ratePercent}%` },
  { key: 'minRatePercent', label: 'Min %', render: (row) => `${row.minRatePercent}%` },
  { key: 'maxRatePercent', label: 'Max %', render: (row) => `${row.maxRatePercent}%` },
  { key: 'wageEligibilityCeiling', label: 'Wage Ceiling' },
  { key: 'calculationWageCeiling', label: 'Calc Ceiling' },
];

export default function BonusRatesPage() {
  return <SlabPage<BonusRateRow> title="Bonus Rates" apiPath="/api/masters/bonus-rates" fields={fields} columns={columns} itemLabel="Bonus Rate" />;
}
