'use client';

import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

export default function DesignationsPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Designation" />
      <SimpleMasterPage
      title="Designations"
      apiPath="/api/masters/designations"
      statsModule="designations"
      autoCode
      extraFields={[
        { name: 'qualification', label: 'Qualification', type: 'text', placeholder: 'e.g. B.E / B.Tech' },
        { name: 'experienceYears', label: 'Experience (years)', type: 'number', min: 0, max: 60, step: '0.5', placeholder: 'e.g. 2' },
        { name: 'budget', label: 'Budget', type: 'number', min: 0, placeholder: 'Monthly budget for this designation' },
        { name: 'sanctionedHeadcount', label: 'Sanctioned Headcount', type: 'number', min: 0, placeholder: 'e.g. 5' },
      ]}
      extraColumns={[
        {
          key: 'headcount',
          label: 'Headcount (Current / Sanctioned)',
          render: (row) => {
            const { sanctionedHeadcount: sanctioned, currentHeadcount: current } = row as unknown as { sanctionedHeadcount: number | null; currentHeadcount: number };
            if (sanctioned == null) {
              return <span style={{ color: 'var(--foreground)' }}>{current} / —</span>;
            }
            const shortBy = sanctioned - current;
            return (
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--foreground)' }}>
                  {current} / {sanctioned}
                </span>
                {shortBy > 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                    title={`${shortBy} position${shortBy === 1 ? '' : 's'} still open against the sanctioned headcount`}
                  >
                    {shortBy} short
                  </span>
                ) : shortBy < 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
                    title="Currently staffed above the sanctioned headcount"
                  >
                    {-shortBy} over
                  </span>
                ) : (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                    Full
                  </span>
                )}
              </div>
            );
          },
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
      })}
      />
    </div>
  );
}
