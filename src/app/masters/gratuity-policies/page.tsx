'use client';

import SlabPage from '@/components/SlabPage';
import type { Column, FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. GRAT-2026' },
  { name: 'policyName', label: 'Policy Name', type: 'text', required: true, placeholder: 'e.g. Standard Gratuity Policy' },
  { name: 'multiplierNumerator', label: 'Multiplier Numerator', type: 'number', required: true, step: '0.01', min: 0, defaultValue: 15, helpText: 'e.g. 15 in the 15/26 formula' },
  { name: 'multiplierDenominator', label: 'Multiplier Denominator', type: 'number', required: true, step: '0.01', min: 0, defaultValue: 26, helpText: 'e.g. 26 in the 15/26 formula' },
  { name: 'minEligibleServiceYears', label: 'Min Eligible Service (Years)', type: 'number', required: true, step: '0.01', min: 0, defaultValue: 5 },
  { name: 'maxGratuityCeiling', label: 'Max Gratuity Ceiling', type: 'number', required: true, step: '0.01', min: 0, helpText: 'Statutory/company cap on payable gratuity' },
  { name: 'effectiveFrom', label: 'Effective From', type: 'date', required: true },
  { name: 'effectiveTo', label: 'Effective To', type: 'date', helpText: 'Leave blank for currently active' },
  { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
];

interface GratuityPolicyRow {
  id: number;
  code: string;
  policyName: string;
  multiplierNumerator: number;
  multiplierDenominator: number;
  minEligibleServiceYears: number;
  maxGratuityCeiling: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

const columns: Column<GratuityPolicyRow>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'policyName', label: 'Policy Name' },
  { key: 'multiplierNumerator', label: 'Numerator' },
  { key: 'multiplierDenominator', label: 'Denominator' },
  { key: 'minEligibleServiceYears', label: 'Min Service (Yrs)' },
  { key: 'maxGratuityCeiling', label: 'Ceiling' },
];

export default function GratuityPoliciesPage() {
  return (
    <SlabPage<GratuityPolicyRow>
      title="Gratuity Policies"
      apiPath="/api/masters/gratuity-policies"
      fields={fields}
      columns={columns}
      itemLabel="Gratuity Policy"
    />
  );
}
