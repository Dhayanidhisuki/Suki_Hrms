"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, History } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { apiGet } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { downloadExcel } from "@/lib/downloadExcel";
import { toastError, toastSuccess } from "@/lib/appToast";

type MonthCell = { plan: boolean; actual: boolean };
type CalendarRow = {
  toolOrGaugeNo: string;
  name: string | null;
  grouping: string | null;
  type: string | null;
  kind: "Calibration" | "Preventive";
  months: Record<number, MonthCell>;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cellLabel(c?: MonthCell): string {
  if (!c) return "";
  if (c.plan && c.actual) return "P/A";
  if (c.plan) return "P";
  if (c.actual) return "A";
  return "";
}

export default function CalibrationCalendarPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [issueFor, setIssueFor] = useState("ALL");
  const [grouping, setGrouping] = useState("");
  const [type, setType] = useState("");
  const [fromMonth, setFromMonth] = useState(1);
  const [toMonth, setToMonth] = useState(12);
  const [applied, setApplied] = useState({
    year: thisYear,
    issueFor: "ALL",
    grouping: "",
    type: "",
    fromMonth: 1,
    toMonth: 12,
  });
  const [items, setItems] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      year: String(applied.year),
      issueFor: applied.issueFor,
      fromMonth: String(applied.fromMonth),
      toMonth: String(applied.toMonth),
    });
    if (applied.grouping.trim()) params.set("grouping", applied.grouping.trim());
    if (applied.type.trim()) params.set("type", applied.type.trim());
    const res = await apiGet<{ items: CalendarRow[] }>(`/api/calibration/calendar?${params}`);
    if (res.error) {
      toastError(res.error.message);
      setItems([]);
    } else {
      setItems(res.data?.items ?? []);
    }
    setLoading(false);
  }, [applied]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const monthCols = useMemo(() => {
    const cols: number[] = [];
    for (let m = applied.fromMonth; m <= applied.toMonth; m++) cols.push(m);
    return cols;
  }, [applied.fromMonth, applied.toMonth]);

  const exportExcel = () => {
    if (items.length === 0) {
      toastError("Nothing to export.");
      return;
    }
    downloadExcel({
      filename: `calib_pm_calendar_${applied.year}`,
      sheetName: `Year ${applied.year}`,
      columns: [
        { key: "toolOrGaugeNo", label: "Item No" },
        { key: "name", label: "Name" },
        { key: "kind", label: "Issued For" },
        { key: "grouping", label: "Group" },
        { key: "type", label: "Type" },
        ...monthCols.map((m) => ({
          key: `m${m}`,
          label: MONTHS[m - 1],
          value: (row: CalendarRow) => cellLabel(row.months[m]),
        })),
      ],
      rows: items,
    });
    toastSuccess(`Exported ${items.length} rows.`);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calibration / PM Calendar</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Year view Plan (P) vs Actual (A) ·{" "}
                <Link href="/dashboard/calibration/due-list" className="text-[var(--primary)] underline-offset-2 hover:underline">
                  Due List
                </Link>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={exportExcel} disabled={items.length === 0}>
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
            </Button>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              <div>
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-control"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="form-label">Issued For</label>
                <select className="form-control" value={issueFor} onChange={(e) => setIssueFor(e.target.value)}>
                  <option value="ALL">ALL</option>
                  <option value="Calibration">Calibration</option>
                  <option value="Preventive MNT">Preventive MNT</option>
                </select>
              </div>
              <div>
                <label className="form-label">From Month</label>
                <select className="form-control" value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">To Month</label>
                <select className="form-control" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Group</label>
                <input className="form-control" value={grouping} onChange={(e) => setGrouping(e.target.value)} placeholder="contains…" />
              </div>
              <div>
                <label className="form-label">Type</label>
                <input className="form-control" value={type} onChange={(e) => setType(e.target.value)} placeholder="contains…" />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    setApplied({
                      year,
                      issueFor,
                      grouping,
                      type,
                      fromMonth: Math.min(fromMonth, toMonth),
                      toMonth: Math.max(fromMonth, toMonth),
                    })
                  }
                >
                  Apply
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
              <History className="w-3 h-3" />
              P = planned due · A = completed · P/A = both in month
            </p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] px-4 py-3 overflow-auto">
            {loading ? (
              <TableSkeleton rows={6} />
            ) : items.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-10">
                No plan/actual markers for {applied.year} with current filters.
              </div>
            ) : (
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                    {["Item No", "Name", "For", "Group", ...monthCols.map((m) => MONTHS[m - 1])].map((col) => (
                      <th
                        key={col}
                        className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-2 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {items.map((row) => (
                    <tr key={`${row.kind}-${row.toolOrGaugeNo}`} className="hover:bg-[var(--bg-hover)]">
                      <td className="py-2 px-2 font-mono text-xs font-bold">{row.toolOrGaugeNo}</td>
                      <td className="py-2 px-2 text-xs max-w-[10rem] truncate">{row.name ?? "—"}</td>
                      <td className="py-2 px-2 text-[11px]">{row.kind === "Preventive" ? "PM" : "Calib"}</td>
                      <td className="py-2 px-2 text-xs">{row.grouping ?? "—"}</td>
                      {monthCols.map((m) => {
                        const label = cellLabel(row.months[m]);
                        return (
                          <td key={m} className="py-2 px-2 text-center font-mono text-[11px] font-semibold">
                            {label ? (
                              <span
                                className={
                                  label === "P/A"
                                    ? "text-emerald-600"
                                    : label === "A"
                                      ? "text-blue-600"
                                      : "text-amber-600"
                                }
                              >
                                {label}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
