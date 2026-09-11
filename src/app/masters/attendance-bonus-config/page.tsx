'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'bonusAmount',
    label: 'Bonus Amount',
    type: 'number',
    required: true,
    min: 0,
    step: '0.01',
    defaultValue: 0,
    helpText: 'Flat bonus amount for qualifying attendance',
  },
  {
    name: 'requiresZeroLop',
    label: 'Requires Zero LOP',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Employee must have zero LOP days to qualify',
  },
  {
    name: 'requiresZeroLate',
    label: 'Requires Zero Late',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Employee must have zero late minutes to qualify',
  },
  {
    name: 'requiresZeroEarlyOut',
    label: 'Requires Zero Early-Out',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Employee must have zero early-out minutes to qualify',
  },
  {
    name: 'prorateByPayableDays',
    label: 'Prorate by Payable Days',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Prorate bonus by payableDays/totalDays ratio',
  },
  {
    name: 'minPayableDaysPercent',
    label: 'Min Payable Days (%)',
    type: 'number',
    required: true,
    min: 0,
    max: 100,
    step: '0.01',
    defaultValue: 100,
    helpText: 'Minimum % of payable days to qualify (100 = full month)',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function AttendanceBonusConfigPage() {
  return (
    <SingleConfigPage
      title="Attendance Bonus Configuration"
      description="Defines the bonus for perfect attendance. When no config exists, no attendance bonus is applied."
      apiPath="/api/masters/attendance-bonus-config"
      fields={fields}
    />
  );
}
