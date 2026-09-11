'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'defaultRegime',
    label: 'Default Regime',
    type: 'select',
    required: true,
    defaultValue: 'NEW',
    helpText: 'Which TDS regime to apply by default',
    options: [
      { label: 'New Regime', value: 'NEW' },
      { label: 'Old Regime', value: 'OLD' },
    ],
  },
  {
    name: 'financialYearStart',
    label: 'Financial Year Start Month',
    type: 'number',
    required: true,
    min: 1,
    max: 12,
    defaultValue: 4,
    helpText: 'Month (1-12) the financial year starts (April = 4)',
  },
  {
    name: 'cessRate',
    label: 'Cess Rate (%)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 4,
    helpText: 'Health & education cess on tax',
  },
  {
    name: 'surchargeThreshold',
    label: 'Surcharge Threshold',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 5000000,
    helpText: 'Annual income above which surcharge applies',
  },
  {
    name: 'surchargeRate',
    label: 'Surcharge Rate (%)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 10,
    helpText: 'Surcharge percentage on tax',
  },
  {
    name: 'rebateUptoIncome',
    label: '87A Rebate Income Limit',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 500000,
    helpText: 'Annual income up to which 87A rebate applies',
  },
  {
    name: 'rebateAmount',
    label: '87A Rebate Amount',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 12500,
    helpText: 'Rebate amount under section 87A',
  },
  {
    name: 'standardDeduction',
    label: 'Standard Deduction',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 50000,
    helpText: 'Old regime standard deduction',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function TdsRegimeConfigPage() {
  return (
    <SingleConfigPage
      title="TDS Regime Configuration"
      description="Controls TDS calculation regime, cess, surcharge, and 87A rebate. When no config exists, payroll uses the new regime with statutory defaults."
      apiPath="/api/masters/tds-regime-config"
      fields={fields}
    />
  );
}
