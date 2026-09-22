'use client';

import SlabPage from '@/components/SlabPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. OT-SLAB-1' },
  { name: 'name', label: 'Slab Name', type: 'text', required: true, placeholder: 'e.g. 0-25 hours' },
  { name: 'minOtHours', label: 'Min OT Hours', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Lower bound (inclusive)' },
  { name: 'maxOtHours', label: 'Max OT Hours', type: 'number', step: '0.01', min: 0, helpText: 'Upper bound (exclusive, blank = no upper limit)' },
  { name: 'flatBonusAmount', label: 'Flat Bonus Amount', type: 'number', step: '0.01', min: 0, placeholder: 'e.g. 500', helpText: 'A fixed monthly bonus for reaching this OT-hours band. If set, this is paid instead of the multiplier below.' },
  { name: 'incentiveMultiplier', label: 'Incentive Multiplier', type: 'number', required: true, step: '0.01', min: 0.01, defaultValue: 1, helpText: 'Multiplier on OT amount for hours in this slab (e.g. 1.25 = 25% extra). Ignored when a flat bonus amount is set above.' },
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
  flatBonusAmount: number | null;
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
  { key: 'flatBonusAmount', label: 'Flat Bonus', render: (row) => (row.flatBonusAmount != null ? `₹${row.flatBonusAmount}` : '—') },
  { key: 'incentiveMultiplier', label: 'Multiplier' },
];

export default function OTIncentiveSlabsPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <SlabPage<OTIncentiveSlabRow>
        statsModule="ot-incentive-slabs"
        title="OT Incentive Slabs"
        apiPath="/api/masters/ot-incentive-slabs"
        fields={fields}
        columns={columns}
        itemLabel="OT Incentive Slab"
      />
    </div>
  );
}
