'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'employeeContributionRate',
    label: 'Employee Contribution Rate (%)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 0,
    helpText: 'Employee contribution as % of gross',
  },
  {
    name: 'employerContributionRate',
    label: 'Employer Contribution Rate (%)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 0,
    helpText: 'Employer contribution as % of gross',
  },
  {
    name: 'monthlyPremium',
    label: 'Monthly Premium',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 0,
    helpText: 'Flat monthly premium amount',
  },
  {
    name: 'applyToAllEmployees',
    label: 'Apply to All Employees',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Whether this applies to all employees automatically',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function HealthInsuranceConfigPage() {
  return (
    <SingleConfigPage
      title="Health Insurance Configuration"
      description="Controls employee and employer health insurance contributions. When no config exists, no health insurance deduction is applied."
      apiPath="/api/masters/health-insurance-config"
      fields={fields}
    />
  );
}
