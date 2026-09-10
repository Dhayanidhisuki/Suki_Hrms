/**
 * Masters > Employee > Levels. A level sits under a grade (migration
 * 000023), so the form offers the grade list and the table shows the grade.
 */

'use client';

import { useEffect, useState } from 'react';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import type { FieldOption } from '@/components/ui';

export default function LevelsPage() {
  const [gradeOptions, setGradeOptions] = useState<FieldOption[]>([]);

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
    <SimpleMasterPage
      title="Levels"
      apiPath="/api/masters/levels"
      extraFields={[{ name: 'gradeId', label: 'Grade', type: 'select', required: true, options: gradeOptions }]}
      extraColumns={[
        { key: 'grade', label: 'Grade', render: (row) => (row.grade as { name: string } | null | undefined)?.name ?? '—' },
      ]}
      extraInitialValues={(row) => ({ gradeId: (row.gradeId as number | null | undefined) ?? undefined })}
    />
  );
}
