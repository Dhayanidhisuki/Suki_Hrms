'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. PT-KA', helpText: 'Unique code for this state PT config' },
  { name: 'state', label: 'State', type: 'text', required: true, placeholder: 'e.g. Karnataka' },
  { name: 'slabCode', label: 'PT Slab Code', type: 'text', required: true, placeholder: 'e.g. PT-KA-1', helpText: 'Links to ProfessionalTaxSlab.code' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface StatePtConfigRow {
  id: number;
  code: string; // SlabPage requires this field; we use state as the code
  state: string;
  slabCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<StatePtConfigRow>[] = [
  { key: 'state', label: 'State', sortable: true, className: 'font-medium' },
  { key: 'slabCode', label: 'Slab Code' },
];

export default function StatePtConfigsPage() {
  return (
    <SlabPage<StatePtConfigRow>
      statsModule="state-pt-configs"
      title="State PT Configs"
      apiPath="/api/masters/state-pt-configs"
      fields={fields}
      columns={columns}
      itemLabel="State PT Config"
    />
  );
}
