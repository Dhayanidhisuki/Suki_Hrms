"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { ChartContainer, CalibrationAgingDonut } from "@/components/OverviewCharts";
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
    <SimpleMasterShell title="Calibration Overview" subtitle="Issue, receive, results update, and due list monitoring">
      <div className="space-y-6">
        {/* Graphical Representation: Calibration Aging Donut Chart */}
        <ChartContainer
          title="Calibration Health & Due Schedule Breakdown"
          subtitle="Real-time distribution of gauge calibration statuses and upcoming due dates"
        >
          <CalibrationAgingDonut />
        </ChartContainer>

        {/* Quick Link Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 hover:border-[var(--primary)] transition-all shadow-sm"
            >
              <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{c.value}</p>
              <p className="text-sm font-medium text-[var(--text-primary)] mt-1">{c.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </SimpleMasterShell>
  );
}
