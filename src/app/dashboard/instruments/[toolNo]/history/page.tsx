"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Orbit } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import ToolJourneyTimeline from "@/components/ToolJourneyTimeline";
import { apiGet } from "@/lib/apiClient";

type InstrumentHistoryHeader = {
  tool: {
    refNo: number;
    toolOrGaugeNo: string;
    description: string | null;
    grouping: string;
    status: string | null;
  };
};

export default function InstrumentHistoryPage() {
  const params = useParams<{ toolNo: string }>();
  const toolNo = decodeURIComponent(params.toolNo);
  const [data, setData] = useState<InstrumentHistoryHeader | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiGet<InstrumentHistoryHeader>(
      `/api/instruments/${encodeURIComponent(toolNo)}/history`
    ).then((res) => {
      if (res.error) setError(res.error.message);
      else setData(res.data ?? null);
    });
  }, [toolNo]);

  return (
    <div className="flex h-screen bg-[var(--bg-app)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/dashboard/tools-history-card"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to History Card
            </Link>

            <section className="rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-main)] pb-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Orbit className="h-5 w-5 text-[var(--primary)]" />
                    <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                      360° Instrument Travel History
                    </h1>
                  </div>
                  <p className="font-mono text-sm font-semibold text-[var(--primary)]">
                    {data?.tool.toolOrGaugeNo || toolNo}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {data?.tool.description || "Instrument / gauge lifecycle"}
                    {data?.tool.grouping ? ` · ${data.tool.grouping}` : ""}
                  </p>
                </div>
                {data?.tool.status && (
                  <span className="rounded-full border border-[var(--border-main)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold">
                    Current status: {data.tool.status}
                  </span>
                )}
              </div>

              {error ? (
                <div className="py-12 text-center text-sm font-semibold text-[var(--color-danger-text)]">
                  {error}
                </div>
              ) : data ? (
                <ToolJourneyTimeline
                  toolOrGaugeNo={data.tool.toolOrGaugeNo}
                  refNo={data.tool.refNo}
                />
              ) : (
                <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                  Loading complete instrument journey…
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
