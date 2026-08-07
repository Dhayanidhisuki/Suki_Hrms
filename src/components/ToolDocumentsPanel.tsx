"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Trash2, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiDelete } from "@/lib/apiClient";
import { toastSuccess, toastError } from "@/lib/appToast";
import { TOOL_DOC_TYPES, type ToolDocType } from "@/lib/toolDocumentTypes";

export type ToolDocumentItem = {
  id: number;
  toolOrGaugeNo: string;
  docType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  calibRowId: number | null;
  dcNo: string | null;
  remarks: string | null;
  creatUserIdCd: string;
  creatDt: string;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  CALIB_CERTIFICATE: "Calib Certificate",
  CALIB_REPORT: "Calib Report",
  TOOL_MANUAL: "Tool Manual",
  DRAWING: "Drawing",
  DC_ATTACHMENT: "DC Attachment",
  OTHER: "Other",
};

const ACCEPT_ATTR =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.msg,.eml,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip";

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return v.includes("T") ? v.split("T")[0] : v;
}

interface ToolDocumentsPanelProps {
  toolOrGaugeNo?: string;
  /** When set, uploads are tagged to this calib issue line */
  calibRowId?: number | null;
  dcNo?: string | null;
  /** Default type when uploading */
  defaultDocType?: ToolDocType;
  /** Restrict selectable types (Results = certificates; History = all) */
  allowedTypes?: ToolDocType[];
  canUpload?: boolean;
  compact?: boolean;
  title?: string;
  /** Override the upload button label (ERP: Upload/Change Image) */
  uploadButtonLabel?: string;
  /**
   * panel — bordered list chrome (default, other modules)
   * form — compact labeled fields + list / empty state
   */
  variant?: "panel" | "form";
  /** When true, load/count only — render nothing (for grid badge while collapsed) */
  collapsed?: boolean;
  /** Notify parent of file count (for action-grid badge) */
  onCountChange?: (count: number) => void;
  /** Optional close control for embedded expand panels */
  onClose?: () => void;
}

export function ToolDocumentsPanel({
  toolOrGaugeNo = "",
  calibRowId = null,
  dcNo = null,
  defaultDocType = "OTHER",
  allowedTypes,
  canUpload = true,
  compact = false,
  title = "Documents",
  uploadButtonLabel = "Upload",
  variant = "panel",
  collapsed = false,
  onCountChange,
  onClose,
}: ToolDocumentsPanelProps) {
  const types = allowedTypes?.length ? allowedTypes : [...TOOL_DOC_TYPES];
  const [items, setItems] = useState<ToolDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [docType, setDocType] = useState<ToolDocType>(
    types.includes(defaultDocType) ? defaultDocType : types[0]
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const canQuery = Boolean(toolOrGaugeNo || dcNo);
  const isForm = variant === "form";

  const load = useCallback(async () => {
    if (!canQuery) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (toolOrGaugeNo) params.set("toolOrGaugeNo", toolOrGaugeNo);
    if (dcNo) params.set("dcNo", String(dcNo));
    const res = await apiGet<{ items: ToolDocumentItem[] }>(
      `/api/tools/documents?${params}`
    );
    if (res.error) {
      toastError(res.error.message);
      setItems([]);
    } else {
      let list = res.data?.items ?? [];
      if (calibRowId) {
        list = [...list].sort((a, b) => {
          const aMatch = a.calibRowId === calibRowId ? 0 : 1;
          const bMatch = b.calibRowId === calibRowId ? 0 : 1;
          return aMatch - bMatch;
        });
      }
      setItems(list);
    }
    setLoading(false);
  }, [toolOrGaugeNo, dcNo, calibRowId, canQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) onCountChange?.(items.length);
  }, [items.length, loading, onCountChange]);

  const handleUpload = async (file: File | null) => {
    if (!file || !canQuery) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (toolOrGaugeNo) form.append("toolOrGaugeNo", toolOrGaugeNo);
      form.append("docType", docType);
      if (calibRowId != null) form.append("calibRowId", String(calibRowId));
      if (dcNo) form.append("dcNo", String(dcNo));

      const res = await fetch("/api/tools/documents", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Upload failed"
        );
      }
      toastSuccess(`Uploaded ${file.name}`);
      setPendingName("");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onFilePicked = (file: File | null) => {
    if (!file) {
      setPendingName("");
      return;
    }
    if (isForm) {
      setPendingName(file.name);
      return;
    }
    void handleUpload(file);
  };

  const handleDownload = (id: number, name: string) => {
    const a = document.createElement("a");
    a.href = `/api/tools/documents/${id}/file`;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this document?")) return;
    const res = await apiDelete<{ ok: boolean }>(`/api/tools/documents/${id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Document removed");
    await load();
  };

  const hint = (
    <p className="text-[11px] text-[var(--text-muted)]">
      PDF, Office, images, ZIP, email · max 10 MB
      {dcNo ? (
        <>
          {" "}
          · DC <span className="font-mono font-semibold">#{dcNo}</span>
        </>
      ) : null}
      {toolOrGaugeNo && !isForm ? (
        <>
          {" "}
          · tool <span className="font-mono font-semibold">{toolOrGaugeNo}</span>
        </>
      ) : null}
    </p>
  );

  const formFileList =
    !loading && items.length > 0 ? (
      <ul className="rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-card)] divide-y divide-[var(--border-main)] overflow-hidden">
        {items.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-hover)]"
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold text-[var(--text-primary)] truncate"
                title={d.originalName}
              >
                {d.originalName}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 items-center rounded-md border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] px-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {fmtDate(d.creatDt)}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {fmtSize(d.sizeBytes)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                title="Download"
                onClick={() => handleDownload(d.id, d.originalName)}
                className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {canUpload && (
                <button
                  type="button"
                  title="Remove"
                  onClick={() => void handleDelete(d.id)}
                  className="inline-flex p-1.5 rounded-lg text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    ) : null;

  const panelFileList =
    !loading && items.length > 0 ? (
      <div className="overflow-auto max-h-48 rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-card)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)]">
              {["File", "Type", "Size", "Date", ""].map((h) => (
                <th
                  key={h || "a"}
                  className="text-left text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider py-1.5 px-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {items.map((d) => (
              <tr key={d.id} className="hover:bg-[var(--bg-hover)]">
                <td className="py-2 px-2 max-w-[160px]">
                  <p
                    className="font-semibold text-[var(--text-primary)] truncate"
                    title={d.originalName}
                  >
                    {d.originalName}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">{d.creatUserIdCd}</p>
                </td>
                <td className="py-2 px-2 whitespace-nowrap">
                  {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                </td>
                <td className="py-2 px-2 font-mono whitespace-nowrap">
                  {fmtSize(d.sizeBytes)}
                </td>
                <td className="py-2 px-2 font-mono whitespace-nowrap">
                  {fmtDate(d.creatDt)}
                </td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    title="Download"
                    onClick={() => handleDownload(d.id, d.originalName)}
                    className="inline-flex p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {canUpload && (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => void handleDelete(d.id)}
                      className="inline-flex p-1.5 rounded-lg text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null;

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTR}
      className="hidden"
      onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
    />
  );

  if (collapsed) return null;

  if (isForm) {
    return (
      <div className="space-y-3">
        {(onClose || title) && (
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {title}
            </h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close documents"
                className="inline-flex p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {canUpload && (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-3 items-end">
            <label className="block min-w-0">
              <span className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
                Document Type
              </span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as ToolDocType)}
                className="w-full h-9 text-xs border-[0.5px] border-[var(--border-main)] rounded-[12px] px-3 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-subtle)] focus:border-[var(--primary)]"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
                File
              </span>
              <button
                type="button"
                disabled={!canQuery || uploading}
                onClick={() => inputRef.current?.click()}
                className="w-full h-9 flex items-center gap-2 rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-card)] px-3 text-left text-xs outline-none hover:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary-subtle)] disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                <span
                  className={`truncate ${
                    pendingName
                      ? "font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {pendingName || "Choose a file…"}
                </span>
              </button>
              {hiddenInput}
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-[12px] border-[0.5px]"
              disabled={uploading || !canQuery || !pendingName}
              onClick={() => {
                const file = inputRef.current?.files?.[0] ?? null;
                void handleUpload(file);
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : uploadButtonLabel}
            </Button>
          </div>
        )}

        {hint}

        {loading ? (
          <p className="py-4 text-center text-[11px] text-[var(--text-muted)]">
            Loading documents…
          </p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[var(--text-muted)]">
            No documents yet — select a type and choose a file above
          </p>
        ) : (
          formFileList
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[12px] border-[0.5px] border-[var(--border-main)] bg-[var(--bg-subtle)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--primary)]" />
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {title}
          </h3>
          <span className="font-mono text-[10px] font-semibold bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded-full">
            {loading ? "…" : items.length}
          </span>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as ToolDocType)}
              className="text-xs border-[0.5px] border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            {hiddenInput}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || !canQuery}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : uploadButtonLabel}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-2">{hint}</div>

      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">Loading documents…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No documents uploaded yet.</p>
      ) : (
        panelFileList
      )}
    </div>
  );
}
