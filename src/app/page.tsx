import Sidebar from "./dashboard/components/Sidebar";
import PageHeader from "./dashboard/components/PageHeader";
import KpiRow from "./dashboard/components/KpiRow";
import ToolsByGroup from "./dashboard/components/ToolsByGroup";
import ActivityTable from "./dashboard/components/ActivityTable";
import ToolStatusDonut from "./dashboard/components/ToolStatusDonut";
import QuickActions from "./dashboard/components/QuickActions";
import MonthlyMovementsBarChart from "./dashboard/components/MonthlyMovementsBarChart";
import CumulativeGrowthAreaChart from "./dashboard/components/CumulativeGrowthAreaChart";
import RecentCalibrationTable from "./dashboard/components/RecentCalibrationTable";
import TopBar from "./dashboard/components/TopBar";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Right panel (topbar + scrollable content) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar search + notification + profile */}
        <TopBar />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          {/* ── Page Header + CTA ── */}
          <PageHeader />

          {/* ── 4 Top KPI Cards ── */}
          <KpiRow />

          {/* ── Main Content Grid (Charts + Quick Actions) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
            {/* LEFT 2-COLUMN CHARTS GRID */}
            <div className="space-y-6">
              {/* Row 1 Charts: Monthly Bar & Cumulative Area */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonthlyMovementsBarChart />
                <CumulativeGrowthAreaChart />
              </div>

              {/* Row 2 Charts: Tools By Group & Tool Status Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ToolsByGroup />
                <ToolStatusDonut />
              </div>

              {/* Row 3 Data Tables: Recent Calibration Due & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentCalibrationTable />
                <ActivityTable />
              </div>
            </div>

            {/* RIGHT SIDE PANEL: Quick Actions */}
            <div className="sticky top-0 space-y-6">
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
