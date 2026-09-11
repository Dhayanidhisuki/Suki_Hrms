'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'allowNegativeNet',
    label: 'Allow Negative Net Salary',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'If unchecked, employees with negative net salary are put on HOLD',
  },
  {
    name: 'minNetPercentOfGross',
    label: 'Minimum Net (% of Gross)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 0,
    helpText: 'Minimum net salary as % of gross (0 = no minimum)',
  },
  {
    name: 'requireApprovalIfNegative',
    label: 'Require Approval if Negative',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Require manual approval to release negative-net payroll lines',
  },
  {
    name: 'maxDeductionPercent',
    label: 'Max Deduction (% of Gross)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 100,
    helpText: 'Maximum total deductions as % of gross (100 = no limit)',
  },
  {
    name: 'statutoryIncludedInLimit',
    label: 'Statutory Included in Limit',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Whether PF/ESI/PT/TDS count toward the max deduction limit',
  },
];

export default function PayrollValidationConfigPage() {
  return (
    <SingleConfigPage
      title="Payroll Validation Configuration"
      description="Controls payroll validation rules — negative net salary, minimum net, and maximum deduction limits. Employees violating these rules are put on HOLD with a reason."
      apiPath="/api/masters/payroll-validation-config"
      fields={fields}
    />
  );
}
