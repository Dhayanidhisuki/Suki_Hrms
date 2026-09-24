'use client';

import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import { Users2, BarChart3 } from 'lucide-react';
import { useModuleStats } from '@/hooks/useModuleStats';

export default function EmployeeTypesPage() {
  const { stats } = useModuleStats('employee-types');

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Employee" />
      <SimpleMasterPage
        statsModule="employee-types"
        title="Employee Types"
        subtitle="Manage workplace classification schemes, probation rules, overtime eligibility, and statutory assignments."
        icon={<Users2 />}
        extraStat={{
          label: 'Mapped Workforce',
          value: (stats.custom?.currentHeadcount as number | undefined) ?? 0,
          icon: <BarChart3 />,
          subtitle: 'Active staff currently classified',
        }}
        apiPath="/api/masters/employee-types"
        autoCode
      />
    </div>
  );
}
