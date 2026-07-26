"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, ShieldAlert, FileCheck2 } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";

interface CalibReceiveLine {
  id: number;
  calibRcvNo: string;
  toolOrGaugeNo: string;
  calibrationDate: string;
  result: string;
  nextCalibDate: string;
  certificateFileName: string | null;
  remarks: string | null;
  tool?: { name: string } | null;
}

interface CalibReceiveHeader {
  id: number;
  calibRcvNo: string;
  calibDcNo: string;
  receiveDate: string;
  creatUserIdCd: string;
  lines: CalibReceiveLine[];
  calibIssue?: { labName: string | null; issueType: string } | null;
}

const resultConfig: Record<string, { bg: string; text: string }> = {
  Pass: { bg: "bg-[var(--color-success-bg)] border border-[var(--border-main)]", text: "text-[var(--color-success-text)]" },
  Fail: { bg: "bg-[var(--color-danger-bg)] border border-[var(--border-main)]", text: "text-[var(--color-danger-text)]" },
  "Conditional Pass": { bg: "bg-[var(--color-warning-bg)] border border-[var(--border-main)]", text: "text-[var(--color-warning-text)]" },
};

export default function CalibrationReceivePage() {
  const [records, setRecords] = useState<CalibReceiveHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRcv, setExpandedRcv] = useState<number | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items: CalibReceiveHeader[] }>("/api/calibration/receive");
    if (res.data?.items) setRecords(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Flatten all lines across all receive headers for the table view
  const allLines = records.flatMap((r) =>
    r.lines.map((l) => ({
      ...l,
      calibRcvNo: r.calibRcvNo,
      receiveDate: r.receiveDate,
      labName: r.calibIssue?.labName ?? null,
    }))
  );

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Receive from Calibration
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Record calibration results and certificates (GAUGE_CONTROL_CARD_TRANS)
            </p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] p-5">
            {loading ? (
              <TableSkeleton rows={4} />
            ) : records.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-8">
                No calibration receive records found.
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((rcv) => {
                  const isExpanded = expandedRcv === rcv.id;
                  return (
                    <div key={rcv.id} className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{rcv.calibRcvNo}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            DC Ref: <span className="font-semibold text-[var(--text-primary)] font-mono">{rcv.calibDcNo}</span> · Lab: {rcv.calibIssue?.labName ?? "—"} · Received: {rcv.receiveDate ? rcv.receiveDate.split("T")[0] : "—"}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedRcv(isExpanded ? null : rcv.id)}
                          className="text-xs font-semibold text-[var(--primary)] hover:underline transition-colors"
                        >
                          {isExpanded ? "Hide lines" : `View ${rcv.lines.length} line(s)`}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="overflow-auto border-t border-[var(--border-main)] pt-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[var(--text-muted)] font-bold text-[10px] uppercase bg-[var(--bg-card)]">
                                {["Tool No", "Name", "Calib Date", "Result", "Next Due", "Certificate", "Remarks"].map((col) => (
                                  <th key={col} className="text-left py-2 px-3">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-main)]">
                              {rcv.lines.map((line) => {
                                const rc = resultConfig[line.result] ?? { bg: "bg-[var(--bg-hover)]", text: "text-[var(--text-muted)]" };
                                return (
                                  <tr key={line.id} className="text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-hover)]">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-secondary)]">{line.toolOrGaugeNo}</td>
                                    <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                                    <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">{line.calibrationDate ? line.calibrationDate.split("T")[0] : "—"}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${rc.bg} ${rc.text}`}>
                                        {line.result}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">{line.nextCalibDate ? line.nextCalibDate.split("T")[0] : "—"}</td>
                                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                                      {line.certificateFileName ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline cursor-pointer">
                                          <FileCheck2 className="w-3.5 h-3.5" />
                                          {line.certificateFileName}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-[var(--text-muted)]">No file</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-[var(--text-muted)]">{line.remarks ?? "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && records.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border-main)]">
                <span className="text-xs text-[var(--text-muted)]">
                  {allLines.length} calibration record(s) across {records.length} receive(s)
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
