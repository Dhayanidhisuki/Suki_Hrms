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
    helpText: 'Encash unused leaves per LeaveEncashmentConfig',
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
    defaultValue: false,
    helpText: 'Pay proportionate bonus for the period worked',
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
