"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Trash2, Upload, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiDelete } from "@/lib/apiClient";
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
}: ToolDocumentsPanelProps) {
  const types = allowedTypes?.length ? allowedTypes : [...TOOL_DOC_TYPES];
  const [items, setItems] = useState<ToolDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<ToolDocType>(
    types.includes(defaultDocType) ? defaultDocType : types[0]
  );
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canQuery = Boolean(toolOrGaugeNo || dcNo);

  const load = useCallback(async () => {
    if (!canQuery) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (toolOrGaugeNo) params.set("toolOrGaugeNo", toolOrGaugeNo);
    if (dcNo) params.set("dcNo", String(dcNo));
    // History card: all docs for tool. Results: still show all for tool so certs are visible;
    // upload tags calibRowId when provided. When dcNo-only, list by DC.
    const res = await apiGet<{ items: ToolDocumentItem[] }>(
      `/api/tools/documents?${params}`
    );
    if (res.error) {
      setError(res.error.message);
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

  const handleUpload = async (file: File | null) => {
    if (!file || !canQuery) return;
    setUploading(true);
    setError("");
    setBanner("");
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
      setBanner(`Uploaded ${file.name}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
    setError("");
    const res = await apiDelete<{ ok: boolean }>(`/api/tools/documents/${id}`);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setBanner("Document removed");
    await load();
  };

  return (
    <div
      className={`rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] ${
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
              className="text-xs border border-[var(--border-main)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || !canQuery}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[var(--text-muted)] mb-2">
        PDF, Office, images, ZIP, email · max 10 MB
        {dcNo ? (
          <>
            {" "}
            · DC <span className="font-mono font-semibold">#{dcNo}</span>
          </>
        ) : null}
        {toolOrGaugeNo ? (
          <>
            {" "}
            · tool <span className="font-mono font-semibold">{toolOrGaugeNo}</span>
          </>
        ) : null}
      </p>

      {error && (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-danger-text)]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}
      {banner && !error && (
        <p className="mb-2 text-xs font-semibold text-[var(--color-success-text)]">{banner}</p>
      )}

      {loading ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">Loading documents…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="overflow-auto max-h-48 border border-[var(--border-main)] rounded-lg bg-[var(--bg-card)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
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
                    <p className="font-semibold text-[var(--text-primary)] truncate" title={d.originalName}>
                      {d.originalName}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{d.creatUserIdCd}</p>
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    {DOC_TYPE_LABELS[d.docType] ?? d.docType}
                  </td>
                  <td className="py-2 px-2 font-mono whitespace-nowrap">{fmtSize(d.sizeBytes)}</td>
                  <td className="py-2 px-2 font-mono whitespace-nowrap">{fmtDate(d.creatDt)}</td>
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
      )}
    </div>
  );
}
