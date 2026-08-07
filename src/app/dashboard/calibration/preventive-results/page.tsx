"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, Wrench } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { OverlayModal } from "@/components/ui/OverlayModal";
import { ToolDocumentsPanel } from "@/components/ToolDocumentsPanel";
import { toastSuccess, toastError } from "@/lib/appToast";
import { StatusBadge } from "@/components/ui/StatusBadge";

type DueRow = {
  toolRefNo: number;
  toolOrGaugeNo: string | null;
  name: string | null;
  grouping: string | null;
  type: string | null;
  toolStatus: string | null;
  frequencyMonths: number | null;
  unitRefNo: number;
  serialNo: number | null;
  unitStatus: string | null;
  nextPreDate: string | null;
  daysLeft: number | null;
  dueStatus: string;
};

type PmDc = {
  dcNo: number;
  issueDate: string | null;
  receiveName: string | null;
  issueFor: string | null;
  status?: string | null;
  inHouseLines?: {
    toolOrGaugeNo: string | null;
    serialNo: number | null;
    status: string | null;
    dueDate: string | null;
    calibDueDate: string | null;
    tool?: { name: string | null; grouping: string | null; type: string | null } | null;
  }[];
};

const fmtDate = (v?: string | null) => (v ? String(v).split("T")[0] : "—");

function addMonthsIso(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export default function PreventiveResultsPage() {
  const [dueItems, setDueItems] = useState<DueRow[]>([]);
  const [pmDcs, setPmDcs] = useState<PmDc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DueRow | null>(null);
  const [preDate, setPreDate] = useState("");
  const [nextPreDate, setNextPreDate] = useState("");
  const [resultStatus, setResultStatus] = useState("AVAILABLE FOR USE");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dueRes, dcRes] = await Promise.all([
      apiGet<{ items: DueRow[] }>("/api/tools/preventive-due?alertDays=90"),
      apiGet<{ items: PmDc[] }>("/api/calibration/issue?issueFor=Preventive%20MNT"),
    ]);
    setDueItems(dueRes.data?.items ?? []);
    setPmDcs(dcRes.data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openComplete = (row: DueRow) => {
    if (row.unitRefNo <= 0) {
      toastError("This tool has no physical unit row. Add a serial/unit on Item Master before completing PM.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const freq = row.frequencyMonths && row.frequencyMonths > 0 ? row.frequencyMonths : 6;
    setSelected(row);
    setPreDate(today);
    setNextPreDate(addMonthsIso(today, freq));
    setResultStatus("AVAILABLE FOR USE");
    setComments("");
  };

  const saveComplete = async () => {
    if (!selected) return;
    if (!nextPreDate) {
      toastError("Next Preventive date is required.");
      return;
    }
    setSubmitting(true);
    const res = await apiPost("/api/tools/preventive-complete", {
      unitRefNo: selected.unitRefNo,
      nextPreDate,
      remarks: [resultStatus, comments.trim()].filter(Boolean).join(" · ").slice(0, 100) || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess({
      title: "Preventive MNT saved",
      message: `Next PM date set to ${nextPreDate}.`,
      detail: selected.toolOrGaugeNo || undefined,
    });
    setSelected(null);
    void loadData();
  };

  const q = query.trim().toLowerCase();
  const filteredDue = dueItems.filter((r) => {
    if (!q) return true;
    return (
      (r.toolOrGaugeNo || "").toLowerCase().includes(q) ||
      (r.name || "").toLowerCase().includes(q) ||
      (r.grouping || "").toLowerCase().includes(q) ||
      (r.type || "").toLowerCase().includes(q) ||
      String(r.serialNo ?? "").includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Preventive MNT Results</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Complete preventive maintenance for due units and review open PM issue DCs
            </p>
          </div>

          <ModuleKpiRow
            items={[
              {
                id: "pm-due",
                label: "Units Due / Overdue",
                value: dueItems.length,
                subtext: "Alert window 90 days",
                icon: Wrench,
                iconBg: "bg-amber-50 dark:bg-amber-950/30",
                iconColor: "text-amber-600",
                badge: { label: "Due", type: "warning" },
              },
              {
                id: "pm-overdue",
                label: "Overdue",
                value: dueItems.filter((d) => d.dueStatus === "Overdue").length,
                subtext: "Past NXT_PRE_DATE",
                icon: ClipboardList,
                iconBg: "bg-red-50 dark:bg-red-950/30",
                iconColor: "text-red-600",
                badge: { label: "Past due", type: "warning" },
              },
              {
                id: "pm-dcs",
                label: "Open PM DCs",
                value: pmDcs.length,
                subtext: "Issue For = Preventive MNT",
                icon: ClipboardList,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "DC", type: "info" },
              },
            ]}
          />

          <MasterTableCard
            toolbar={
              <>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
                  Preventive due queue
                </span>
                <MasterSearchInput
                  id="pm-due-search"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search tool, serial, group…"
                  widthClass="w-52"
                />
              </>
            }
          >
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={5} />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["Tool No", "Name", "SI.No", "Group", "Type", "Pre.Due", "Status", "Actions"].map(
                        (col) => (
                          <th
                            key={col}
                            className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {filteredDue.map((row) => (
                      <tr key={`${row.toolRefNo}-${row.unitRefNo}`} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-2.5 px-3 font-mono text-xs font-bold">{row.toolOrGaugeNo ?? "—"}</td>
                        <td className="py-2.5 px-3 text-xs">{row.name ?? "—"}</td>
                        <td className="py-2.5 px-3 font-mono text-xs">{row.serialNo ?? "—"}</td>
                        <td className="py-2.5 px-3 text-xs">{row.grouping ?? "—"}</td>
                        <td className="py-2.5 px-3 text-xs">{row.type ?? "—"}</td>
                        <td className="py-2.5 px-3 font-mono text-xs">{fmtDate(row.nextPreDate)}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={row.dueStatus} />
                        </td>
                        <td className="py-2.5 px-3">
                          <RoleGate permission="canEditMaster">
                            <Button type="button" variant="primary" size="sm" onClick={() => openComplete(row)}>
                              Complete PM
                            </Button>
                          </RoleGate>
                        </td>
                      </tr>
                    ))}
                    {filteredDue.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No preventive due units in the alert window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </MasterTableCard>

          <MasterTableCard
            className="mt-4"
            toolbar={
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Open Preventive MNT DCs
              </span>
            }
          >
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={3} />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {["DC", "Issue Date", "Issued To", "Tools", "Status"].map((col) => (
                        <th
                          key={col}
                          className="text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2 px-3"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {pmDcs.map((dc) => {
                      const lines = dc.inHouseLines ?? [];
                      const preview = lines
                        .map((l) => l.toolOrGaugeNo)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(", ");
                      return (
                        <tr key={dc.dcNo} className="hover:bg-[var(--bg-hover)]">
                          <td className="py-2.5 px-3 font-mono text-xs font-bold">#{dc.dcNo}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{fmtDate(dc.issueDate)}</td>
                          <td className="py-2.5 px-3 text-xs">{dc.receiveName ?? "—"}</td>
                          <td className="py-2.5 px-3 text-xs font-mono">
                            {preview || "—"}
                            {lines.length > 3 ? `… · ${lines.length}` : lines.length ? ` · ${lines.length}` : ""}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={dc.status || "OPEN"} />
                          </td>
                        </tr>
                      );
                    })}
                    {pmDcs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          No Preventive MNT issue DCs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </MasterTableCard>
        </main>
      </div>

      <OverlayModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Complete Preventive MNT"
        subtitle={selected?.toolOrGaugeNo || undefined}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={submitting} onClick={() => void saveComplete()}>
              <Check className="w-4 h-4" />
              {submitting ? "Saving…" : "Save PM Result"}
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="form-label">Tool</p>
                <p className="font-mono font-semibold">{selected.toolOrGaugeNo}</p>
              </div>
              <div>
                <p className="form-label">Serial</p>
                <p className="font-mono font-semibold">{selected.serialNo ?? "—"}</p>
              </div>
              <div>
                <p className="form-label">Current Pre.Due</p>
                <p className="font-mono">{fmtDate(selected.nextPreDate)}</p>
              </div>
              <div>
                <p className="form-label">Frequency (months)</p>
                <p className="font-mono">{selected.frequencyMonths ?? "—"}</p>
              </div>
            </div>
            <div>
              <label className="form-label">Pre.MNT Date</label>
              <input
                type="date"
                className="form-control"
                value={preDate}
                onChange={(e) => {
                  setPreDate(e.target.value);
                  const freq =
                    selected.frequencyMonths && selected.frequencyMonths > 0
                      ? selected.frequencyMonths
                      : 6;
                  if (e.target.value) setNextPreDate(addMonthsIso(e.target.value, freq));
                }}
              />
            </div>
            <div>
              <label className="form-label">Nxt Pre.MNT Date *</label>
              <input
                type="date"
                className="form-control"
                value={nextPreDate}
                onChange={(e) => setNextPreDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Result Status</label>
              <select
                className="form-control"
                value={resultStatus}
                onChange={(e) => setResultStatus(e.target.value)}
              >
                <option value="AVAILABLE FOR USE">AVAILABLE FOR USE</option>
                <option value="OUT OF SERVICE">OUT OF SERVICE</option>
                <option value="NOT IN USE">NOT IN USE</option>
              </select>
            </div>
            <div>
              <label className="form-label">Comments</label>
              <textarea
                className="form-control"
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
            {selected.toolOrGaugeNo && (
              <ToolDocumentsPanel
                toolOrGaugeNo={selected.toolOrGaugeNo}
                defaultDocType="OTHER"
                allowedTypes={["OTHER", "CALIB_REPORT"]}
                title="PM documents"
                uploadButtonLabel="Upload document"
                compact
              />
            )}
          </div>
        )}
      </OverlayModal>
    </div>
  );
}
