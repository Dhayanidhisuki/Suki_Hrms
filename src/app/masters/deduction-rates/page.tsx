/**
 * Deduction Rates (KUN BRD review, 2026-09-10, item 15) — a catch-all rate
 * table for misc. statutory/company deductions (Canteen, Uniform, Damage
 * recovery, ...) alongside the dedicated TDS/PT/ESI/PF slabs. Includes
 * Loss-of-Pay rows (isLop) per the client's decision to fold that in here
 * rather than a separate Common Logic section — see /masters/common-logic,
 * which stays just the Gross % split.
 *
 * Company-scoped, versioned like the other slab masters — built on the
 * same SlabPage component (companyId is inferred server-side from the
 * session, so it never needs to be a form field here).
 */

'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

interface DeductionRateRow {
  id: number;
  code: string;
  name: string;
  deductionType: 'PERCENT' | 'FLAT';
  rateValue: number;
  isLop: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

// Code is auto-generated from Name (slugified, e.g. "Canteen Deduction" →
// "CANTEEN_DEDUCTION") on Add, and matched against a SalaryComponent's own
// code for display purposes — so it stays stable on Edit even if Name
// changes for an unrelated reason, rather than silently breaking that link.
function generateDeductionRateCode(values: Record<string, string | number | boolean | undefined>): string {
  return String(values.name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildFields(isEditing: boolean): FieldDef[] {
  return [
  isEditing
    ? { name: 'code', label: 'Code', type: 'text', required: true }
    : { name: 'code', label: 'Code', type: 'text', required: true, hidden: true, compute: generateDeductionRateCode },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Canteen Deduction' },
  // Deduction Rates are always a flat currency amount now — no Percent
  // option in the UI (deductionType stays in the schema/DB, just always
  // submitted as FLAT going forward; existing PERCENT rows aren't touched).
  { name: 'deductionType', label: 'Type', type: 'select', defaultValue: 'FLAT', hidden: true, options: [{ label: 'Flat Amount', value: 'FLAT' }] },
  { name: 'rateValue', label: 'Amount', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Flat currency amount deducted.' },
  { name: 'isLop', label: 'Loss of Pay (LOP) rate', type: 'checkbox', defaultValue: false, helpText: 'Flags this row as the attendance-based Loss-of-Pay deduction rate.' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
  ];
}

async function toggleActive(row: DeductionRateRow) {
  await fetch(`/api/masters/deduction-rates/${row.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: row.code,
      name: row.name,
      deductionType: row.deductionType,
      rateValue: row.rateValue,
      isLop: row.isLop,
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

const columns: Column<DeductionRateRow>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name' },
  {
    key: 'rateValue',
    label: 'Rate / Amount',
    render: (row) => (row.deductionType === 'PERCENT' ? `${row.rateValue}%` : String(row.rateValue)),
  },
  {
    key: 'isLop',
    label: 'LOP',
    render: (row) =>
      row.isLop ? (
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}>
          LOP
        </span>
      ) : (
        <span style={{ color: 'var(--foreground-muted)' }}>—</span>
      ),
  },
];

export default function DeductionRatesPage() {
  return (
    <SlabPage
      title="Deduction Rates"
      apiPath="/api/masters/deduction-rates"
      fields={buildFields}
      columns={columns}
      itemLabel="Deduction Rate"
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
        title: 'Delete Deduction Rate',
        message: 'This permanently deletes the deduction rate — it will no longer apply to any employee, active or inactive. This cannot be undone.',
        confirmLabel: 'Delete',
      }}
    />
  );
}
