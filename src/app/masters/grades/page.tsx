'use client';

import { useCallback, useEffect, useState } from 'react';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldOption } from '@/components/ui';

export default function GradesPage() {
  const [designationOptions, setDesignationOptions] = useState<FieldOption[]>([]);

  const loadDesignations = useCallback(async () => {
    try {
      const res = await fetch('/api/masters/designations?limit=500');
      if (!res.ok) return;
      const json = await res.json();
      setDesignationOptions((json.data as Array<{ id: number; name: string }>).map((d) => ({ label: d.name, value: d.id })));
    } catch {
      /* select simply stays empty */
    }
  }, []);

  useEffect(() => {
    void loadDesignations();
  }, [loadDesignations]);

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Designation" />
      <SimpleMasterPage
        title="Grades"
        apiPath="/api/masters/grades"
        statsModule="grades"
        extraFields={[{ name: 'designationId', label: 'Designation', type: 'select', required: true, options: designationOptions }]}
        extraColumns={[
          {
            key: 'designation',
            label: 'Designation',
            render: (row) => (row.designation as { name: string } | null | undefined)?.name ?? '—',
          },
        ]}
        extraInitialValues={(row) => ({ designationId: (row.designationId as number | null | undefined) ?? undefined })}
      />
    </div>
  );
}
