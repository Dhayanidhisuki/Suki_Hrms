'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. OT-SLAB-1' },
  { name: 'name', label: 'Slab Name', type: 'text', required: true, placeholder: 'e.g. 0-25 hours' },
  { name: 'minOtHours', label: 'Min OT Hours', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Lower bound (inclusive)' },
  { name: 'maxOtHours', label: 'Max OT Hours', type: 'number', step: '0.01', min: 0, helpText: 'Upper bound (exclusive, blank = no upper limit)' },
  { name: 'incentiveMultiplier', label: 'Incentive Multiplier', type: 'number', required: true, step: '0.01', min: 0.01, defaultValue: 1, helpText: 'Multiplier on OT amount for hours in this slab (e.g. 1.25 = 25% extra)' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface OTIncentiveSlabRow {
  id: number;
  code: string;
  name: string;
  minOtHours: number;
  maxOtHours: number | null;
  incentiveMultiplier: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<OTIncentiveSlabRow>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name' },
  { key: 'minOtHours', label: 'Min Hours' },
  { key: 'maxOtHours', label: 'Max Hours' },
  { key: 'incentiveMultiplier', label: 'Multiplier' },
];

export default function OTIncentiveSlabsPage() {
  return (
    <SlabPage<OTIncentiveSlabRow>
      statsModule="ot-incentive-slabs"
      title="OT Incentive Slabs"
      apiPath="/api/masters/ot-incentive-slabs"
      fields={fields}
      columns={columns}
      itemLabel="OT Incentive Slab"
    />
  );
}
