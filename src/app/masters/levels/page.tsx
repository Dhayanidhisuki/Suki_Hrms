/**
 * Masters > Employee > Levels. A level sits under a grade (migration
 * 000023), so the form offers the grade list and the table shows the grade.
 */

'use client';

import { useEffect, useState } from 'react';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldOption } from '@/components/ui';
import { Layers, Users } from 'lucide-react';
import { useModuleStats } from '@/hooks/useModuleStats';

export default function LevelsPage() {
  const [gradeOptions, setGradeOptions] = useState<FieldOption[]>([]);
  const { stats } = useModuleStats('levels');

  useEffect(() => {
    fetch('/api/masters/grades?limit=500')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) =>
        setGradeOptions(
          (json.data as Array<{ id: number; name: string; designation?: { name: string } | null }>).map((g) => ({
            label: g.designation?.name ? `${g.name} — ${g.designation.name}` : g.name,
            value: g.id,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Designation" />
      <SimpleMasterPage
        statsModule="levels"
        title="Levels"
        subtitle="Define organizational tier bands, reporting authority, and grade mapping structure."
        icon={<Layers />}
        extraStat={{
          label: 'Employees Assigned',
          value: (stats.custom?.currentHeadcount as number | undefined) ?? 0,
          icon: <Users />,
          subtitle: 'Active staff mapped to a tier band',
        }}
        apiPath="/api/masters/levels"
        codeLabel="Level Code"
        nameLabel="Level Name"
        extraFields={[{ name: 'gradeId', label: 'Grade', type: 'select', required: true, options: gradeOptions }]}
        extraColumns={[
          { key: 'grade', label: 'Grade', render: (row) => (row.grade as { name: string } | null | undefined)?.name ?? '—' },
        ]}
        extraInitialValues={(row) => ({ gradeId: (row.gradeId as number | null | undefined) ?? undefined })}
      />
    </div>
  );
}
