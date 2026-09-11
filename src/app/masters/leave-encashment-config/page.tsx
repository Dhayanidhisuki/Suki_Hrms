'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'calculationBasis',
    label: 'Calculation Basis',
    type: 'select',
    required: true,
    defaultValue: 'GROSS',
    helpText: 'Which salary base to use for per-day encashment rate',
    options: [
      { label: 'Gross Salary', value: 'GROSS' },
      { label: 'Basic Salary', value: 'BASIC' },
      { label: 'Basic + DA', value: 'BASIC_DA' },
    ],
  },
  {
    name: 'denominator',
    label: 'Denominator (days)',
    type: 'number',
    required: true,
    min: 1,
    max: 31,
    defaultValue: 26,
    helpText: 'Days denominator (26 per gratuity formula, or 30 calendar)',
  },
  {
    name: 'minServiceMonths',
    label: 'Min Service (months)',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 0,
    helpText: 'Minimum service months to qualify (0 = no minimum)',
  },
  {
    name: 'maxEncashableDays',
    label: 'Max Encashable Days',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 45,
    helpText: 'Maximum leave days encashable per year',
  },
  {
    name: 'includeEarnedOnly',
    label: 'Earned Leaves Only',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Encash only earned (credited) leaves, not accrued',
  },
  {
    name: 'prorateByLop',
    label: 'Prorate by LOP',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Reduce encashable days by LOP days',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function LeaveEncashmentConfigPage() {
  return (
    <SingleConfigPage
      title="Leave Encashment Configuration"
      description="Defines how leave encashment is calculated — basis, denominator, eligibility, and caps. When no config exists, encashment uses gross / 26 × days."
      apiPath="/api/masters/leave-encashment-config"
      fields={fields}
    />
  );
}
