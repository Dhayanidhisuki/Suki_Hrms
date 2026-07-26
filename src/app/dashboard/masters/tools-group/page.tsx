"use client";

import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";

export default function ToolsGroupPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg-app)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6">
          <div className="bg-[var(--bg-card)] text-[var(--text-primary)] rounded-2xl p-8 border border-[var(--border-main)] text-center max-w-xl mx-auto mt-12 shadow-sm">
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Tools Group</h1>
            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
          </div>
        </main>
      </div>
    </div>
  );
}
