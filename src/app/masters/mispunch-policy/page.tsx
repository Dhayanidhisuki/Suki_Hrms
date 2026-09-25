'use client';

import SingleConfigPage from '@/components/SingleConfigPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldDef } from '@/components/ui';
import { Fingerprint } from 'lucide-react';

export default function MispunchPolicyPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Workforce" />
      <SingleConfigPage
        title="Mis-Punch Policy"
        icon={<Fingerprint />}
        description="Controls how far back an employee can request a biometric correction, and how many they may file in a month."
        apiPath="/api/masters/mispunch-policy"
        sections={[
          {
            title: 'Limits',
            description: 'How far back a correction can be dated, and the monthly cap on requests.',
            icon: <Fingerprint />,
            fields: [
              { name: 'maxBackdateDays', label: 'Max Back-dated Days', type: 'number', required: true, min: 0, defaultValue: 60, helpText: 'A correction cannot be requested for a date older than this many days.' },
              { name: 'maxRequestsPerMonth', label: 'Max Requests Per Month', type: 'number', required: true, min: 0, defaultValue: 3, helpText: 'Hard cap on mis-punch requests an employee can submit in a calendar month.' },
              { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
            ] as FieldDef[],
          },
        ]}
      />
    </div>
  );
}
