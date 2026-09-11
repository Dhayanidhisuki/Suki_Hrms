'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'roundingMode',
    label: 'Rounding Mode',
    type: 'select',
    required: true,
    defaultValue: 'NEAREST_1',
    helpText: 'How to round salary amounts',
    options: [
      { label: 'No Rounding', value: 'NONE' },
      { label: 'Nearest 1', value: 'NEAREST_1' },
      { label: 'Nearest 5', value: 'NEAREST_5' },
      { label: 'Nearest 10', value: 'NEAREST_10' },
      { label: 'Nearest 100', value: 'NEAREST_100' },
    ],
  },
  {
    name: 'applyTo',
    label: 'Apply To',
    type: 'select',
    required: true,
    defaultValue: 'NET_ONLY',
    helpText: 'Which amounts to round',
    options: [
      { label: 'Net Salary Only', value: 'NET_ONLY' },
      { label: 'All Components', value: 'ALL_COMPONENTS' },
    ],
  },
  {
    name: 'showRoundOff',
    label: 'Show Round-Off Line',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Display the rounding difference as a separate line on the payslip',
  },
];

export default function RoundingConfigPage() {
  return (
    <SingleConfigPage
      title="Salary Rounding Configuration"
      description="Controls how salary amounts are rounded on the payslip. When no row exists, payroll uses Math.round() (nearest 1)."
      apiPath="/api/masters/rounding-config"
      fields={fields}
    />
  );
}
