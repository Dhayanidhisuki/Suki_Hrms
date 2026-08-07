"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { CalibrationAgingDonut } from "@/components/OverviewCharts";
import { apiGet } from "@/lib/apiClient";

export default function Page() {
  const [stats, setStats] = useState({ issues: 0, due: 0, pendingResults: 0, receives: 0 });

  useEffect(() => {
    (async () => {
      const [issues, due, results, receives] = await Promise.all([
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/issue"),
        apiGet<{ items: unknown[]; total?: number }>("/api/tools/calibration-due"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/results-update"),
        apiGet<{ items: unknown[]; total?: number }>("/api/calibration/receive"),
      ]);
      setStats({
        issues: issues.data?.total ?? issues.data?.items?.length ?? 0,
        due: due.data?.total ?? due.data?.items?.length ?? 0,
        pendingResults: results.data?.total ?? results.data?.items?.length ?? 0,
        receives: receives.data?.total ?? receives.data?.items?.length ?? 0,
      });
    })();
  }, []);

  const cards = [
    {
      href: "/dashboard/calibration/issue",
      label: "Calibration Issue",
      desc: "Send tools for calibration",
      value: stats.issues,
    },
    {
      href: "/dashboard/calibration/receive",
      label: "Calibration Receive",
      desc: "Receive back from lab",
      value: stats.receives,
    },
    {
      href: "/dashboard/calibration/results-update",
      label: "Results Update",
      desc: "Update certificate / result",
      value: stats.pendingResults,
    },
    {
      href: "/dashboard/calibration/due-list",
      label: "Due List",
      desc: "NXT_CALIB_DATE / CALIB_DUE_DATE",
      value: stats.due,
    },
  ];

  return (
    <SimpleMasterShell
      title="Calibration Overview"
      subtitle="Issue, receive, results update, and due list monitoring"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.85fr] gap-6 items-stretch">
        {/* Left: donut chart panel */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5 sm:p-6 shadow-sm flex flex-col min-h-[480px]">
          <div className="mb-2">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Calibration Health & Due Schedule Breakdown
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Real-time distribution of gauge calibration statuses and upcoming due dates
            </p>
          </div>
          <div className="flex-1 min-h-[380px]">
            <CalibrationAgingDonut />
          </div>
        </div>

        {/* Right: stacked KPI cards */}
        <div className="flex flex-col gap-4 min-h-0">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex-1 block bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 hover:border-[var(--primary)] transition-all shadow-sm group"
            >
              <p className="text-3xl font-semibold text-[var(--text-primary)] tabular-nums leading-none group-hover:text-[var(--primary)] transition-colors">
                {c.value}
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-3">{c.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </SimpleMasterShell>
  );
}
