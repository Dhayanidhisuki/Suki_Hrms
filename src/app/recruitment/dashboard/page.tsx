import DashboardClient from '@/components/recruitment/DashboardClient';

/**
 * Recruitment > Dashboard — BRD §5.1, §10.5.
 * Real pipeline counts + velocity metrics from the candidate data.
 */
export default function RecruitmentDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Recruitment Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Pipeline visibility and hiring velocity metrics (BRD §5.1, §10.5).
        </p>
      </div>
      <DashboardClient />
    </div>
  );
}
