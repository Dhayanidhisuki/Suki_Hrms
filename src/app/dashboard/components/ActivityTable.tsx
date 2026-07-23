"use client";

import { Search } from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/apiClient";

export type ActivityStatus = "Issued" | "Received" | "Overdue";

interface IssueRecord {
  id: number;
  dcNo: string;
  deptName: string;
  partyName: string;
  issueDate: string;
  dueDate: string;
  status: string;
}

function mapStatus(issue: IssueRecord): ActivityStatus {
  if (issue.status === "CLOSED") return "Received";
  const due = new Date(issue.dueDate);
  if (due < new Date()) return "Overdue";
  return "Issued";
}

const statusConfig: Record<
  ActivityStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  Issued: {
    label: "Issued",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  Received: {
    label: "Received",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  Overdue: {
    label: "Overdue",
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
  },
};

export default function ActivityTable() {
  const [filter, setFilter] = useState<ActivityStatus | "All">("All");
  const [rawFeed, setRawFeed] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ items: IssueRecord[] }>("/api/issue").then((res) => {
      if (res.data?.items) setRawFeed(res.data.items);
      setLoading(false);
    });
  }, []);

  const activityFeed = rawFeed.map((issue) => ({
    id: String(issue.id),
    empId: issue.deptName,
    empDisplay: issue.partyName,
    toolName: `${issue.deptName} — ${issue.dcNo}`,
    toolOrGaugeNo: issue.dcNo,
    issueDate: issue.issueDate.slice(0, 10),
    dueDate: issue.dueDate.slice(0, 10),
    status: mapStatus(issue),
  }));

  const filtered =
    filter === "All"
      ? activityFeed
      : activityFeed.filter((r) => r.status === filter);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Tools Issue Activity
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Recent movements from GaugeToolsIssue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
            {(["All", "Issued", "Received", "Overdue"] as const).map((s) => (
              <button
                key={s}
                id={`activity-filter-${s.toLowerCase()}`}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  filter === s
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            id="activity-search-btn"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className={`overflow-auto transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {["Employee (empId)", "Tool (toolOrGaugeNo)", "Issue Date", "Due Date", "Status"].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-2.5 pr-4 last:pr-0"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row) => {
              const sc = statusConfig[row.status];
              return (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/60 transition-colors group"
                >
                  {/* Employee (empId display) */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0">
                        {row.empId.split("-")[1]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate text-sm leading-tight">
                          {row.empDisplay}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono leading-tight">
                          {row.empId}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Tool (toolOrGaugeNo + name) */}
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-700">{row.toolName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {row.toolOrGaugeNo}
                    </p>
                  </td>

                  {/* Issue Date */}
                  <td className="py-3 pr-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {row.issueDate}
                  </td>

                  {/* Due Date */}
                  <td
                    className={`py-3 pr-4 whitespace-nowrap font-mono text-xs font-medium ${
                      row.status === "Overdue"
                        ? "text-red-600"
                        : "text-slate-600"
                    }`}
                  >
                    {row.dueDate}
                  </td>

                  {/* Status badge */}
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.text}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                      />
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Showing {filtered.length} of {activityFeed.length} issue records
        </span>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors">
          View all GaugeToolsIssue activity →
        </button>
      </div>
    </div>
  );
}
