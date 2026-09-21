'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'includeUnpaidSalary',
    label: 'Include Unpaid Salary',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Pay salary up to the last working day',
  },
  {
    name: 'includeLeaveEncashment',
    label: 'Include Leave Encashment',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Exit F&F: last-drawn Basic ÷ calendar days of last salary month × EL days. No in-service 45-day cap.',
  },
  {
    name: 'includeGratuity',
    label: 'Include Gratuity',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Pay gratuity if eligible per GratuityPolicy',
  },
  {
    name: 'includeBonusProportion',
    label: 'Include Proportionate Bonus',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'KUN: statutory bonus on FY earned basic × rate. Skipped if bonus is already PROCESSED.',
  },
  {
    name: 'includeNoticePay',
    label: 'Include Notice Pay',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Notice pay recovery (short notice) or payable (served)',
  },
  {
    name: 'noticePeriodDays',
    label: 'Notice Period (days)',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 30,
    helpText: 'Standard notice period in days',
  },
  {
    name: 'includeLoanRecovery',
    label: 'Include Loan Recovery',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Recover outstanding loan balance from settlement',
  },
  {
    name: 'includeAssetRecovery',
    label: 'Include Asset Recovery',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Deduct value of unreturned assets',
  },
  {
    name: 'salaryDivisor',
    label: 'Salary divisor (days)',
    type: 'number',
    required: true,
    min: 1,
    defaultValue: 30,
    helpText: 'Daily salary = monthly salary ÷ this divisor when mode is 30 days',
  },
  {
    name: 'salaryDivisorMode',
    label: 'Divisor mode',
    type: 'select',
    required: true,
    defaultValue: 'CALENDAR',
    options: [
      { label: '30 days', value: 'DAYS_30' },
      { label: 'Calendar days in month', value: 'CALENDAR' },
      { label: 'Payroll / working days', value: 'PAYROLL' },
    ],
  },
  {
    name: 'noticeRateBasis',
    label: 'Notice rate basis',
    type: 'select',
    required: true,
    defaultValue: 'GROSS',
    options: [
      { label: 'Gross', value: 'GROSS' },
      { label: 'Basic', value: 'BASIC' },
      { label: 'Basic + DA', value: 'BASIC_DA' },
    ],
  },
  {
    name: 'includeTds',
    label: 'Include TDS',
    type: 'checkbox',
    defaultValue: true,
  },
  {
    name: 'includePf',
    label: 'Include PF (employee)',
    type: 'checkbox',
    defaultValue: true,
  },
  {
    name: 'includeEsi',
    label: 'Include ESI (employee)',
    type: 'checkbox',
    defaultValue: true,
  },
  {
    name: 'includePt',
    label: 'Include professional tax',
    type: 'checkbox',
    defaultValue: true,
  },
  {
    name: 'clearanceRequired',
    label: 'Require exit clearance before calculate',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Payroll can override with a remark if clearance is incomplete',
  },
  {
    name: 'approvalStages',
    label: 'Approval Chain',
    type: 'select',
    required: true,
    defaultValue: 'HR_FINANCE',
    helpText: 'Who needs to approve the FnF settlement',
    options: [
      { label: 'HR Only', value: 'HR' },
      { label: 'HR → Finance', value: 'HR_FINANCE' },
      { label: 'Manager → HR → Finance', value: 'MANAGER_HR_FINANCE' },
    ],
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function FullAndFinalConfigPage() {
  return (
    <SingleConfigPage
      title="Full & Final Settlement Configuration"
      description="Controls which components are included in exit settlement and the approval chain. When no config exists, all components are included with HR → Finance approval."
      apiPath="/api/masters/full-and-final-config"
      fields={fields}
    />
  );
}
