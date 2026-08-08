"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Trash2,
  Edit2,
  Check,
  CalendarClock,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { SimpleMasterShell } from "@/components/SimpleMasterShell";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import { toastSuccess, toastError } from "@/lib/appToast";

interface CalibFreq {
  id: number;
  prodToleranceMin: string | null;
  prodToleranceMax: number | null;
  calibFrequency: number | null;
}

type FormState = {
  prodToleranceMin: string;
  prodToleranceMax: string;
  calibFrequency: string;
};

const EMPTY_FORM: FormState = {
  prodToleranceMin: "",
  prodToleranceMax: "",
  calibFrequency: "",
};

function validate(f: FormState): string | null {
  if (!f.calibFrequency.trim()) return "Calibration frequency (months) is required.";
  const freq = Number(f.calibFrequency);
  if (!Number.isInteger(freq) || freq < 1)
    return "Frequency must be a whole number ≥ 1.";
  if (f.prodToleranceMax.trim() !== "") {
    const max = Number(f.prodToleranceMax);
    if (Number.isNaN(max) || max < 0)
      return "Tolerance Max must be a positive number.";
  }
  return null;
}

function buildPayload(f: FormState) {
  const payload: Record<string, string | number> = {};
  if (f.prodToleranceMin.trim()) payload.prodToleranceMin = f.prodToleranceMin.trim();
  if (f.prodToleranceMax.trim()) payload.prodToleranceMax = Number(f.prodToleranceMax);
  if (f.calibFrequency.trim()) payload.calibFrequency = Number(f.calibFrequency);
  return payload;
}

export default function CalibFrequencyPage() {
  const [items, setItems] = useState<CalibFreq[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Slide-over state
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<CalibFreq | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiGet<{ items?: CalibFreq[] }>("/api/lookups/calib-frequency");
    setItems(
      ((res.data?.items ?? []) as unknown as Record<string, unknown>[]).map((item) => ({
        id: (item.id ?? item.rowId) as number,
        prodToleranceMin: (item.prodToleranceMin as string | null) ?? null,
        prodToleranceMax:
          item.prodToleranceMax != null ? Number(item.prodToleranceMax) : null,
        calibFrequency: item.calibFrequency != null ? Number(item.calibFrequency) : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      [r.prodToleranceMin, r.prodToleranceMax, r.calibFrequency].some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  // ── Open slide-over ──
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setSlideOpen(true);
  };

  const openEdit = (item: CalibFreq) => {
    setEditing(item);
    setForm({
      prodToleranceMin: item.prodToleranceMin ?? "",
      prodToleranceMax: item.prodToleranceMax != null ? String(item.prodToleranceMax) : "",
      calibFrequency: item.calibFrequency != null ? String(item.calibFrequency) : "",
    });
    setFormError("");
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setFormError("");
  };

  // ── Save (add or edit) ──
  const handleSave = async () => {
    const err = validate(form);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) {
        const res = await apiPut(`/api/lookups/calib-frequency/${editing.id}`, payload);
        if (res.error) throw new Error(res.error.message);
        toastSuccess({ title: "Saved", message: "Calibration frequency updated." });
      } else {
        const res = await apiPost("/api/lookups/calib-frequency", payload);
        if (res.error) throw new Error(res.error.message);
        toastSuccess({ title: "Saved", message: "Calibration frequency added." });
      }
      closeSlide();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (deleteId == null) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/lookups/calib-frequency/${deleteId}`);
      if (res.error) throw new Error(res.error.message);
      toastSuccess("Calibration frequency deleted.");
      setDeleteId(null);
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <SimpleMasterShell
      title="Calibration Frequency Master"
      subtitle="CALIBRATION_FREQUENCY_MASTER — define calibration intervals by product tolerance range"
      actions={
        <RoleGate permission="canEditMaster">
          <Button id="calib-freq-add-btn" variant="primary" className="group" onClick={openAdd}>
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            Add Frequency
          </Button>
        </RoleGate>
      }
    >
      {/* ── Info card ── */}
      <div className="mb-5 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-4 flex gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--primary-light)] flex items-center justify-center">
          <Info className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            How calibration frequency is used
          </p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Each entry maps a <strong>product tolerance range</strong> (Min–Max) to a{" "}
            <strong>calibration interval in months</strong>. When a tool is registered
            in the Item / Asset Master its <em>Calib Freq (Months)</em> field is set
            from this table. That value is then used by the{" "}
            <strong>Calibration Due List</strong> to compute the next due date — tighter
            tolerances get shorter intervals. Example: ±0.001 mm → every 3 months,
            ±5 mm → every 12 months.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {[
              { label: "Tolerance Min", hint: 'e.g. "0.001mm" or "0.01"' },
              { label: "Tolerance Max", hint: "upper bound as a number" },
              { label: "Frequency", hint: "whole months, e.g. 3 / 6 / 12" },
            ].map(({ label, hint }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                <CalendarClock className="w-3 h-3 text-[var(--primary)]" />
                <span className="font-medium">{label}</span>
                <span className="text-[var(--text-muted)]">— {hint}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main table card ── */}
      <MasterTableCard
        toolbar={
          <MasterSearchInput
            id="calib-freq-search"
            value={query}
            onChange={setQuery}
            placeholder="Search tolerance, frequency…"
            widthClass="w-56"
          />
        }
        footer={
          <p className="text-[11px] text-[var(--text-muted)]">
            {loading ? "Loading…" : `${filtered.length} of ${items.length} record${items.length !== 1 ? "s" : ""}`}
          </p>
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
                  {["#", "Prod Tolerance Min", "Prod Tolerance Max", "Calib Frequency (months)", "Actions"].map(
                    (col) => (
                      <th
                        key={col}
                        className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3 last:text-right"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {filtered.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-hover)] transition-colors group">
                    <td className="py-3 px-3 text-[11px] text-[var(--text-muted)] tabular-nums w-8">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">
                      {row.prodToleranceMin ?? <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-[var(--text-secondary)]">
                      {row.prodToleranceMax != null ? (
                        row.prodToleranceMax
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {row.calibFrequency != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)] opacity-70 shrink-0" />
                          <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                            {row.calibFrequency}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {row.calibFrequency === 1 ? "month" : "months"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RoleGate permission="canEditMaster">
                          <button
                            id={`calib-freq-edit-${row.id}`}
                            title="Edit"
                            onClick={() => openEdit(row)}
                            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </RoleGate>
                        <RoleGate permission="canDeleteMaster">
                          <button
                            id={`calib-freq-delete-${row.id}`}
                            title="Delete"
                            onClick={() => setDeleteId(row.id)}
                            className="p-1.5 hover:bg-[var(--color-danger-bg)] rounded-lg text-[var(--text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </RoleGate>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-sm text-[var(--text-muted)]"
                    >
                      {query ? "No records match your search." : "No calibration frequency records yet. Click ‘Add Frequency’ to get started."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </MasterTableCard>

      {/* ── Add / Edit slide-over ── */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-sm bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl flex flex-col h-full border-l border-[var(--border-main)] animate-slide-in-right">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {editing ? "Edit Frequency Rule" : "Add Frequency Rule"}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {editing ? `Editing rule #${editing.id}` : "Define a new tolerance → interval mapping"}
                </p>
              </div>
              <button
                onClick={closeSlide}
                className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Tolerance Min */}
              <div>
                <label htmlFor="cf-slide-min" className="form-label">
                  Product Tolerance Min
                  <span className="ml-1 text-[var(--text-muted)] font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  id="cf-slide-min"
                  value={form.prodToleranceMin}
                  onChange={set("prodToleranceMin")}
                  placeholder='e.g. "0.001mm" or "0.01"'
                  className="form-control placeholder-[var(--text-muted)] font-mono mt-1"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Lower bound of the tolerance range for this rule.
                </p>
              </div>

              {/* Tolerance Max */}
              <div>
                <label htmlFor="cf-slide-max" className="form-label">
                  Product Tolerance Max
                  <span className="ml-1 text-[var(--text-muted)] font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  id="cf-slide-max"
                  type="number"
                  min={0}
                  step="any"
                  value={form.prodToleranceMax}
                  onChange={set("prodToleranceMax")}
                  placeholder="e.g. 1.00"
                  className="form-control placeholder-[var(--text-muted)] font-mono mt-1"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Upper bound of the tolerance range as a decimal number.
                </p>
              </div>

              {/* Calibration Frequency */}
              <div>
                <label htmlFor="cf-slide-freq" className="form-label">
                  Calibration Frequency (months)
                  <span className="ml-1 text-[var(--color-danger-text)]">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    id="cf-slide-freq"
                    type="number"
                    min={1}
                    step={1}
                    value={form.calibFrequency}
                    onChange={set("calibFrequency")}
                    placeholder="e.g. 3, 6, 12"
                    className="form-control placeholder-[var(--text-muted)] font-mono pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] pointer-events-none">
                    months
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  How often tools in this tolerance band must be recalibrated.
                </p>
              </div>

              {/* Example hint */}
              <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Example rules
                </p>
                {[
                  { min: "0.001mm", max: "1.00", freq: "3" },
                  { min: "0.010mm", max: "5.00", freq: "6" },
                  { min: "5.000mm", max: "50.00", freq: "12" },
                ].map((ex) => (
                  <div key={ex.freq} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono">{ex.min}</span>
                    <span>→</span>
                    <span className="font-mono">{ex.max}</span>
                    <span className="ml-auto font-semibold text-[var(--text-primary)]">
                      {ex.freq} mo
                    </span>
                  </div>
                ))}
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--border-main)] px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-danger-text)] shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-[var(--color-danger-text)]">{formError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border-main)] flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeSlide}
                className="px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <Button
                id="cf-slide-save-btn"
                variant="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Rule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ── */}
      {deleteId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-danger-bg)] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger-text)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Delete frequency rule?
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  This will permanently remove the rule. Tools whose calibration
                  frequency was derived from it will not be affected retroactively,
                  but future registrations will no longer match this rule.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                id="cf-delete-confirm-btn"
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SimpleMasterShell>
  );
}
