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
import Link from 'next/link';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import type { FieldOption } from '@/components/ui';
import { EMPLOYEE_MASTER_TABS, EMPLOYEE_MASTERS_PATH, type EmployeeMasterTabKey } from './employeeMasterTabs';

export default function EmployeeMastersTabs({ initialTab }: { initialTab: EmployeeMasterTabKey }) {
  const router = useRouter();
  const [active, setActive] = useState<EmployeeMasterTabKey>(initialTab);
  const tab = EMPLOYEE_MASTER_TABS.find((t) => t.key === active) ?? EMPLOYEE_MASTER_TABS[0];

  // Designation options — used by the Grade form's Designation select AND
  // the Designation form's own "Reports To" select. Re-fetched whenever
  // either tab is opened so a designation added a moment ago elsewhere shows up.
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
  }, [active, loadDesignations]);

  const select = (key: EmployeeMasterTabKey) => {
    setActive(key);
    router.replace(`${EMPLOYEE_MASTERS_PATH}?tab=${key}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Designations &amp; Grades
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Designation and grade masters used across the employee profile.
          </p>
        </div>
        {active === 'designations' && (
          <Link
            href="/masters/designations/jd-upload"
            className="shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            JD Upload
          </Link>
        )}
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
        <SimpleMasterPage
          key="designations"
          embedded
          title={tab.title}
          apiPath={tab.apiPath}
          statsModule="designations"
          extraFields={[
            { name: 'qualification', label: 'Qualification', type: 'text', placeholder: 'e.g. B.E / B.Tech' },
            { name: 'experienceYears', label: 'Experience (years)', type: 'number', min: 0, max: 60, step: '0.5', placeholder: 'e.g. 2' },
            { name: 'budget', label: 'Budget', type: 'number', min: 0, placeholder: 'Monthly budget for this designation' },
            { name: 'sanctionedHeadcount', label: 'Sanctioned Headcount', type: 'number', min: 0, placeholder: 'e.g. 5' },
            {
              name: 'reportsToId',
              label: 'Reports To (Designation)',
              type: 'select',
              options: designationOptions,
              helpText: 'Reporting Structure — the default org-chart template, not a per-employee assignment.',
            },
          ]}
          extraColumns={[
            {
              key: 'headcount',
              label: 'Headcount (Sanctioned / Current)',
              render: (row) => `${(row.sanctionedHeadcount as number | null) ?? '—'} / ${(row.currentHeadcount as number | undefined) ?? 0}`,
            },
            {
              key: 'reportsTo',
              label: 'Reports To',
              render: (row) => (row.reportsTo as { name: string } | null | undefined)?.name ?? '—',
            },
            {
              key: 'jobDescription',
              label: 'JD',
              render: (row) =>
                (row.jobDescription as string | null | undefined) ? (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>
                    Set
                  </span>
                ) : (
                  <span style={{ color: 'var(--foreground-muted)' }}>—</span>
                ),
            },
          ]}
          extraInitialValues={(row) => ({
            qualification: (row.qualification as string | null | undefined) ?? '',
            experienceYears: (row.experienceYears as number | null | undefined) ?? '',
            budget: (row.budget as number | null | undefined) ?? '',
            sanctionedHeadcount: (row.sanctionedHeadcount as number | null | undefined) ?? '',
            reportsToId: (row.reportsToId as number | null | undefined) ?? '',
          })}
        />
      )}
    </div>
  );
}
