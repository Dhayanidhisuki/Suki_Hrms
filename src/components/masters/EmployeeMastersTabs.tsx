/**
 * Masters > Employee > Designations & Grades — the two masters on one page,
 * switched by a pill tab strip. Each tab is the same SimpleMasterPage CRUD
 * the standalone routes used to render; the active tab is mirrored into
 * ?tab= so the page can be deep-linked and the old routes can redirect here.
 *
 * Grades sit under a Designation (migration 000022), so the Grades tab adds
 * a Designation select to the form and a Designation column to the table,
 * fed by the same designation list the Designations tab manages.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import type { FieldOption } from '@/components/ui';
import { EMPLOYEE_MASTER_TABS, EMPLOYEE_MASTERS_PATH, type EmployeeMasterTabKey } from './employeeMasterTabs';

export default function EmployeeMastersTabs({ initialTab }: { initialTab: EmployeeMasterTabKey }) {
  const router = useRouter();
  const [active, setActive] = useState<EmployeeMasterTabKey>(initialTab);
  const tab = EMPLOYEE_MASTER_TABS.find((t) => t.key === active) ?? EMPLOYEE_MASTER_TABS[0];

  // Designation options for the Grade form. Re-fetched whenever the Grades
  // tab is opened so a designation added a moment ago on the other tab shows up.
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
    if (active === 'grades') void loadDesignations();
  }, [active, loadDesignations]);

  const select = (key: EmployeeMasterTabKey) => {
    setActive(key);
    router.replace(`${EMPLOYEE_MASTERS_PATH}?tab=${key}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Designations &amp; Grades
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Designation and grade masters used across the employee profile.
        </p>
      </div>

      <div className="card overflow-x-auto p-2">
        <div className="flex min-w-max items-center gap-1" role="tablist">
          {EMPLOYEE_MASTER_TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => select(t.key)}
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition"
                style={{
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--foreground-muted)',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* key= forces a fresh fetch/search/page state per tab */}
      {tab.key === 'grades' ? (
        <SimpleMasterPage
          key="grades"
          embedded
          title={tab.title}
          apiPath={tab.apiPath}
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
      ) : (
        <SimpleMasterPage key={tab.key} embedded title={tab.title} apiPath={tab.apiPath} statsModule={tab.key} />
      )}
    </div>
  );
}
