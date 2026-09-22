'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldDef } from '@/components/ui';

const fields: FieldDef[] = [
  {
    name: 'minQualifyingHours',
    label: 'Min Qualifying OT Hours',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 4,
    helpText: 'Minimum OT hours on a weekly-off/holiday to earn 1 comp-off day',
  },
  {
    name: 'qualifyingDayTypes',
    label: 'Qualifying Day Types',
    type: 'text',
    required: true,
    defaultValue: 'WEEKLY_OFF,HOLIDAY',
    helpText: 'Comma-separated day types that qualify for comp-off (WEEKLY_OFF, HOLIDAY)',
  },
  {
    name: 'requiresApproval',
    label: 'Requires Approval',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Whether comp-off credit requires HR approval',
  },
  {
    name: 'expiryMonths',
    label: 'Expiry (Months)',
    type: 'number',
    required: true,
    min: 0,
    defaultValue: 3,
    helpText: 'Comp-off expires after N months (0 = never expires)',
  },
  {
    name: 'allowEncashment',
    label: 'Allow Encashment',
    type: 'checkbox',
    defaultValue: false,
    helpText: 'Whether unused comp-off can be encashed at exit or year-end',
  },
  {
    name: 'encashmentRatePerDay',
    label: 'Encashment Rate Per Day',
    type: 'number',
    min: 0,
    step: '0.01',
    helpText: 'Flat amount paid per comp-off day encashed (blank = use daily gross rate)',
  },
  {
    name: 'autoCreditOnApproval',
    label: 'Auto-Credit on OT Approval',
    type: 'checkbox',
    defaultValue: true,
    helpText: 'Automatically credit comp-off when OT is approved as COMP_OFF',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
];

export default function CompOffPolicyPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <SingleConfigPage
        title="Comp-Off Policy"
        description="Defines how compensatory off is earned, expired, and encashed. When no policy exists, comp-off is disabled."
        apiPath="/api/masters/comp-off-policy"
        fields={fields}
      />
    </div>
  );
}
