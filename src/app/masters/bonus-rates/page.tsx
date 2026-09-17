'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

// Code is auto-generated (BONUS-<n>), not typed — mirrors the same
// auto-code convention as Salary Components, PF Rates, ESI Rates and
// Deduction Rates.
function generateBonusRateCode(existing: { code: string }[]): string {
  const nums = existing
    .map((r) => /^BONUS-(\d+)$/.exec(r.code))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return `BONUS-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

function buildFields(isEditing: boolean, existing: { code: string }[]): FieldDef[] {
  return [
  isEditing
    ? { name: 'code', label: 'Code', type: 'text', required: true }
    : { name: 'code', label: 'Code', type: 'text', required: true, hidden: true, compute: () => generateBonusRateCode(existing) },
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
  // Statutory constants under the Payment of Bonus Act — no longer asked.
  // Min/Max Rate % are `compute`d (not a fixed defaultValue) so they always
  // straddle whatever Rate % is actually typed — the server rejects a
  // Rate % outside [Min, Max], and a fixed 8.33/20 default would otherwise
  // silently reject Editing an existing row (whose stored Min/Max predate
  // this change) the moment its Rate % changed to anything the old stored
  // Min/Max didn't already cover.
  { name: 'minRatePercent', label: 'Min Rate %', type: 'number', required: true, hidden: true, compute: (v) => Math.min(8.33, Number(v.ratePercent) || 8.33) },
  { name: 'maxRatePercent', label: 'Max Rate %', type: 'number', required: true, hidden: true, compute: (v) => Math.max(20, Number(v.ratePercent) || 20) },
  { name: 'wageEligibilityCeiling', label: 'Wage Eligibility Ceiling', type: 'number', required: true, defaultValue: 21000, hidden: true },
  { name: 'calculationWageCeiling', label: 'Calculation Wage Ceiling', type: 'number', required: true, defaultValue: 7000, hidden: true },
  { name: 'minWorkingDays', label: 'Min Working Days', type: 'number', required: true, min: 0, defaultValue: 30 },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];
}

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
];

async function toggleActive(row: BonusRateRow) {
  await fetch(`/api/masters/bonus-rates/${row.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: row.code,
      calculationType: row.calculationType,
      ratePercent: row.ratePercent,
      minRatePercent: row.minRatePercent,
      maxRatePercent: row.maxRatePercent,
      wageEligibilityCeiling: row.wageEligibilityCeiling,
      calculationWageCeiling: row.calculationWageCeiling,
      minWorkingDays: row.minWorkingDays,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      isActive: !row.isActive,
    }),
  });
}

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

export default function BonusRatesPage() {
  return (
    <SlabPage<BonusRateRow>
      statsModule="bonus-rates"
      title="Bonus Rates"
      apiPath="/api/masters/bonus-rates"
      fields={buildFields}
      columns={columns}
      itemLabel="Bonus Rate"
      renderRowActions={(row, refetch) => (
        <button
          type="button"
          onClick={async () => {
            await toggleActive(row);
            refetch();
          }}
          title={row.isActive ? 'Deactivate' : 'Activate'}
          className="hover:opacity-70"
          style={{ color: row.isActive ? 'var(--accent)' : 'var(--foreground-muted)' }}
        >
          <EyeIcon open={row.isActive} />
        </button>
      )}
      deleteDialog={{
        title: 'Delete Bonus Rate',
        message: 'This permanently deletes the bonus rate — it will no longer apply to any employee, active or inactive. This cannot be undone.',
        confirmLabel: 'Delete',
      }}
    />
  );
}
