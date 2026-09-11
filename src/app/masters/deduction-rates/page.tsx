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

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. CANTEEN' },
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Canteen Deduction' },
  {
    name: 'deductionType',
    label: 'Type',
    type: 'select',
    required: true,
    options: [
      { label: 'Percent', value: 'PERCENT' },
      { label: 'Flat Amount', value: 'FLAT' },
    ],
  },
  { name: 'rateValue', label: 'Rate / Amount', type: 'number', required: true, step: '0.01', min: 0, helpText: 'A percent (0-100) if Type is Percent, otherwise a flat currency amount.' },
  { name: 'isLop', label: 'Loss of Pay (LOP) rate', type: 'checkbox', defaultValue: false, helpText: 'Flags this row as the attendance-based Loss-of-Pay deduction rate.' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

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
  return <SlabPage title="Deduction Rates" apiPath="/api/masters/deduction-rates" fields={fields} columns={columns} itemLabel="Deduction Rate" />;
}
