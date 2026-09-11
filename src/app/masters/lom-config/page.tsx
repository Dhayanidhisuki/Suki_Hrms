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
    helpText: 'Which salary base to use for LOM deduction',
    options: [
      { label: 'Gross Salary', value: 'GROSS' },
      { label: 'Basic Salary', value: 'BASIC' },
    ],
  },
  {
    name: 'multiplier',
    label: 'Multiplier',
    type: 'number',
    required: true,
    step: '0.01',
    min: 0.01,
    max: 10,
    defaultValue: 1,
    helpText: 'Multiplier applied to LOM amount (1 = no extra penalty, 2 = double)',
  },
  {
    name: 'shiftDurationSource',
    label: 'Shift Duration Source',
    type: 'select',
    required: true,
    defaultValue: 'FIXED_8',
    helpText: 'Where to get the standard shift hours for per-minute rate',
    options: [
      { label: 'Fixed 8 Hours', value: 'FIXED_8' },
      { label: 'From Shift Master', value: 'SHIFT_MASTER' },
    ],
  },
  {
    name: 'payrollDaysDenominator',
    label: 'Payroll Days Denominator',
    type: 'select',
    required: true,
    defaultValue: 'CALENDAR',
    helpText: 'Denominator for daily rate calculation',
    options: [
      { label: 'Calendar Days (28-31)', value: 'CALENDAR' },
      { label: 'Fixed 26 Days', value: 'FIXED_26' },
    ],
  },
  {
    name: 'graceMinutesExempt',
    label: 'Grace Minutes (Exempt)',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 0,
    helpText: 'Minutes of late/early exempt before LOM starts',
  },
  {
    name: 'dailyLomCap',
    label: 'Daily LOM Cap (minutes)',
    type: 'number',
    min: 0,
    helpText: 'Maximum LOM minutes per day (blank = no cap)',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function LomConfigPage() {
  return (
    <SingleConfigPage
      title="LOM Configuration"
      description="Loss of Minutes — converts late + early-out minutes to a salary deduction. When no row exists, payroll uses the default formula: (gross / working days / 8 / 60) × minutes."
      apiPath="/api/masters/lom-config"
      fields={fields}
    />
  );
}
