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
  Pass: { bg: "bg-emerald-50", text: "text-emerald-700" },
  Fail: { bg: "bg-red-50", text: "text-red-700" },
  "Conditional Pass": { bg: "bg-amber-50", text: "text-amber-700" },
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Receive from Calibration
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Record calibration results and certificates (GAUGE_CONTROL_CARD_TRANS)
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            {loading ? (
              <TableSkeleton rows={4} />
            ) : records.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">
                No calibration receive records found.
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((rcv) => {
                  const isExpanded = expandedRcv === rcv.id;
                  return (
                    <div key={rcv.id} className="border border-slate-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-mono text-sm font-bold text-slate-800">{rcv.calibRcvNo}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            DC Ref: <span className="font-semibold text-slate-700 font-mono">{rcv.calibDcNo}</span> · Lab: {rcv.calibIssue?.labName ?? "—"} · Received: {rcv.receiveDate ? rcv.receiveDate.split("T")[0] : "—"}
                          </p>
                        </div>
                        <button
                          onClick={() => setExpandedRcv(isExpanded ? null : rcv.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                          {isExpanded ? "Hide lines" : `View ${rcv.lines.length} line(s)`}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="overflow-auto border-t border-slate-50 pt-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-slate-400 font-bold text-[10px] uppercase bg-slate-50/50">
                                {["Tool No", "Name", "Calib Date", "Result", "Next Due", "Certificate", "Remarks"].map((col) => (
                                  <th key={col} className="text-left py-2 px-3">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {rcv.lines.map((line) => {
                                const rc = resultConfig[line.result] ?? { bg: "bg-slate-100", text: "text-slate-500" };
                                return (
                                  <tr key={line.id} className="text-slate-600 text-xs">
                                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-500">{line.toolOrGaugeNo}</td>
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{line.tool?.name ?? line.toolOrGaugeNo}</td>
                                    <td className="py-2.5 px-3 font-mono">{line.calibrationDate ? line.calibrationDate.split("T")[0] : "—"}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${rc.bg} ${rc.text}`}>
                                        {line.result}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono">{line.nextCalibDate ? line.nextCalibDate.split("T")[0] : "—"}</td>
                                    <td className="py-2.5 px-3 text-slate-500">
                                      {line.certificateFileName ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline cursor-pointer">
                                          <FileCheck2 className="w-3.5 h-3.5" />
                                          {line.certificateFileName}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-300">No file</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-400">{line.remarks ?? "—"}</td>
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
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
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
