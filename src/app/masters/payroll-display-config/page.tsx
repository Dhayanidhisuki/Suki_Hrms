'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'showDeductionPercent',
    label: 'Show Deduction %',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Show each deduction as a percentage of gross on the payslip',
  },
  {
    name: 'decimalPlaces',
    label: 'Decimal Places',
    type: 'number',
    required: true,
    min: 0,
    max: 4,
    defaultValue: 2,
    helpText: 'Number of decimal places to display (0-4)',
  },
  {
    name: 'showYTD',
    label: 'Show Year-to-Date',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Show year-to-date totals on the payslip',
  },
  {
    name: 'showLeaveBalance',
    label: 'Show Leave Balance',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Show leave balance summary on the payslip',
  },
  {
    name: 'showTaxBreakdown',
    label: 'Show Tax Breakdown',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Show TDS tax breakdown on the payslip',
  },
];

export default function PayrollDisplayConfigPage() {
  return (
    <SingleConfigPage
      title="Payslip Display Configuration"
      description="Controls what information is shown on the employee payslip — deduction percentages, decimal places, YTD totals, leave balance, and tax breakdown."
      apiPath="/api/masters/payroll-display-config"
      fields={fields}
    />
  );
}
