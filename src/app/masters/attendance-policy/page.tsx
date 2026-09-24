'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldDef } from '@/components/ui';
import { Clock3, Timer } from 'lucide-react';

export default function AttendancePolicyPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <SingleConfigPage
        title="Attendance Policy"
        icon={<Clock3 />}
        statusLabel="Policy Active & Enforced"
        description="Configure automated punch rules, working grace tolerances, and half-day/full-day thresholds."
        apiPath="/api/masters/attendance-policy"
        sections={[
          {
            title: 'Grace & Break Rules',
            description: 'Punch tolerances and the break deducted from working duration.',
            icon: <Timer />,
            fields: [
              { name: 'breakMinutesPerDay', label: 'Break Minutes Per Day', type: 'number', min: 0, defaultValue: 30, helpText: 'Lunch/tea break deducted from working duration.' },
              { name: 'breakDeductible', label: 'Break is deductible from pay', type: 'checkbox', defaultValue: false },
              { name: 'lateGraceMinutes', label: 'Late Grace Minutes', type: 'number', min: 0, defaultValue: 0, helpText: 'Punch time past shift start before late penalty applies.' },
              { name: 'earlyOutGraceMinutes', label: 'Early Out Grace Minutes', type: 'number', min: 0, defaultValue: 0, helpText: 'Allowed early departure before it is flagged.' },
            ] as FieldDef[],
          },
          {
            title: 'Day Status Thresholds',
            description: 'Effective logged hours that decide half-day vs. full-day, and the auto-absent rule.',
            icon: <Clock3 />,
            fields: [
              { name: 'halfDayMinHours', label: 'Half-Day Min Hours', type: 'number', min: 0, helpText: 'Below this is not even a half day. Blank = no rule.' },
              { name: 'halfDayMaxHours', label: 'Half-Day Max Hours', type: 'number', min: 0, helpText: 'At or above this counts as a full day. Blank = no rule.' },
              { name: 'minFullDayHours', label: 'Min Full Day Hours', type: 'number', min: 1, defaultValue: 8 },
              { name: 'autoAbsentIfNoPunch', label: 'Mark Auto-Absent if no punch recorded', type: 'checkbox', defaultValue: false },
            ] as FieldDef[],
          },
        ]}
      />
    </div>
  );
}
