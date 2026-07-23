import Sidebar from "./dashboard/components/Sidebar";
import PageHeader from "./dashboard/components/PageHeader";
import KpiRow from "./dashboard/components/KpiRow";
import ToolsByGroup from "./dashboard/components/ToolsByGroup";
import ActivityTable from "./dashboard/components/ActivityTable";
import ToolStatusDonut from "./dashboard/components/ToolStatusDonut";
import QuickActions from "./dashboard/components/QuickActions";
import TopBar from "./dashboard/components/TopBar";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Right panel (topbar + scrollable content) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Slim topbar — search + notification + breadcrumb */}
        <TopBar />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* ── Page Header + CTA ── */}
          <PageHeader />

          {/* ── KPI Stat Row ── */}
          <KpiRow />

          {/* ── Two-column body ── */}
          <div className="grid grid-cols-[1fr_340px] gap-4 items-start">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">
              <ToolsByGroup />
              <ActivityTable />
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">
              <ToolStatusDonut />
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
