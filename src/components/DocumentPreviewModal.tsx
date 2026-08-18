"use client";

import { useEffect, useState } from "react";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  Calendar,
  User,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import {
  DOC_TYPE_LABELS,
  isImageType,
  isPdfType,
  type ToolDocType,
} from "@/lib/toolDocumentTypes";

export interface PreviewDocumentItem {
  id: number;
  toolOrGaugeNo: string;
  docType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  calibRowId?: number | null;
  dcNo?: string | null;
  remarks?: string | null;
  creatUserIdCd?: string;
  creatDt?: string;
}

interface DocumentPreviewModalProps {
  document: PreviewDocumentItem | null;
  onClose: () => void;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return v.includes("T") ? v.split("T")[0] : v;
}

export function DocumentPreviewModal({
  document: doc,
  onClose,
}: DocumentPreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!doc) return null;

  const fileUrl = `/api/tools/documents/${doc.id}/file?inline=1`;
  const downloadUrl = `/api/tools/documents/${doc.id}/file`;
  const isImg = isImageType(doc.mimeType, doc.originalName);
  const isPdf = isPdfType(doc.mimeType, doc.originalName);
  const label =
    DOC_TYPE_LABELS[doc.docType as ToolDocType] ?? doc.docType;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-6xl h-[90vh] max-h-[900px] bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-main)] flex items-center justify-between gap-4 shrink-0 bg-[var(--bg-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="text-sm font-bold text-[var(--text-primary)] truncate max-w-md"
                  title={doc.originalName}
                >
                  {doc.originalName}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-subtle)]">
                  {label}
                </span>
                {doc.toolOrGaugeNo && !doc.toolOrGaugeNo.startsWith("CALIB-DC-") && (
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-secondary)]">
                    {doc.toolOrGaugeNo}
                  </span>
                )}
                {doc.dcNo && (
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200">
                    DC #{doc.dcNo}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {fmtDate(doc.creatDt)}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <HardDrive className="w-3 h-3" />
                  {fmtSize(doc.sizeBytes)}
                </span>
                {doc.creatUserIdCd && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {doc.creatUserIdCd}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isImg && (
              <div className="hidden sm:flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono font-semibold px-1 text-[var(--text-muted)] min-w-[42px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(3, s + 0.2))}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScale(1);
                    setRotation(0);
                  }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <a
              href={downloadUrl}
              download={doc.originalName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>

            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 min-h-0 bg-neutral-900/90 dark:bg-black/90 relative flex items-center justify-center overflow-auto p-4">
          {isImg ? (
            <div className="max-w-full max-h-full flex items-center justify-center transition-transform duration-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl}
                alt={doc.originalName}
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
                className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl transition-transform duration-150 select-none"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={doc.originalName}
              className="w-full h-full rounded-lg border-0 bg-white shadow-2xl"
            />
          ) : (
            <div className="text-center p-8 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] max-w-md shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                {doc.originalName}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                In-browser preview is available for Images and PDFs. Click below to download and view this document.
              </p>
              <a
                href={downloadUrl}
                download={doc.originalName}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[var(--primary)] text-white hover:opacity-90"
              >
                <Download className="w-4 h-4" />
                Download Document ({fmtSize(doc.sizeBytes)})
              </a>
            </div>
          )}
        </div>

        {/* Footer info & remarks */}
        {doc.remarks && (
          <div className="px-5 py-2.5 bg-[var(--bg-card)] border-t border-[var(--border-main)] shrink-0 flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Remarks:
            </span>
            <p className="text-xs text-[var(--text-primary)] truncate">
              {doc.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
