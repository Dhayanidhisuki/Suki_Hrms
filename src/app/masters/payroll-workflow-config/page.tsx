'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'enableValidatedStage',
    label: 'Enable VALIDATED Stage',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Adds a VALIDATED stage between CALCULATED and APPROVED',
  },
  {
    name: 'enableSubmittedStage',
    label: 'Enable SUBMITTED Stage',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Adds a SUBMITTED stage before APPROVED',
  },
  {
    name: 'enablePostedStage',
    label: 'Enable POSTED Stage',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Adds a POSTED stage after APPROVED (before LOCKED)',
  },
  {
    name: 'approvalStages',
    label: 'Approval Chain',
    type: 'select',
    required: true,
    defaultValue: 'HR',
    helpText: 'Who needs to approve the payroll run',
    options: [
      { label: 'HR Only', value: 'HR' },
      { label: 'Manager → HR', value: 'MANAGER_HR' },
      { label: 'HR → Finance', value: 'HR_FINANCE' },
      { label: 'Manager → HR → Finance', value: 'MANAGER_HR_FINANCE' },
    ],
  },
  {
    name: 'cutoffDayOfMonth',
    label: 'Payroll Cutoff Day',
    type: 'number',
    min: 1,
    max: 31,
    helpText: 'Day of month by which attendance must be finalized (blank = no cutoff)',
  },
  {
    name: 'allowReopenAfterLock',
    label: 'Allow Reopen After Lock',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Whether authorized users can reopen a locked payroll run',
  },
  {
    name: 'reopenRequiresReason',
    label: 'Reopen Requires Reason',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Whether a reason is mandatory when reopening a locked run',
  },
];

export default function PayrollWorkflowConfigPage() {
  return (
    <SingleConfigPage
      title="Payroll Workflow Configuration"
      description="Controls payroll run workflow stages, approval chain, cutoff day, and reopen rules. Current default workflow: DRAFT → CALCULATED → APPROVED → LOCKED."
      apiPath="/api/masters/payroll-workflow-config"
      fields={fields}
    />
  );
}
