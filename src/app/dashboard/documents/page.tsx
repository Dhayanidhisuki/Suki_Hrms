"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  Camera,
  Grid,
  List,
  Search,
  Filter,
  RefreshCw,
  Image as ImageIcon,
  Award,
  BookOpen,
  Calendar,
  HardDrive,
  User,
  X,
  Plus,
} from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import RoleGate from "@/app/dashboard/components/RoleGate";
import { TableSkeleton } from "@/app/dashboard/components/LoadingSkeleton";
import { ModuleKpiRow } from "@/app/dashboard/components/ModuleKpiRow";
import { MasterSearchInput, MasterTableCard } from "@/components/ui/MasterTableCard";
import { StatusPillTabs } from "@/components/ui/StatusPillTabs";
import { Button } from "@/components/ui/button";
import { apiGet, apiDelete } from "@/lib/apiClient";
import { toastSuccess, toastError } from "@/lib/appToast";
import {
  TOOL_DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_TYPE_GROUPS,
  isPhotoType,
  isImageType,
  isPdfType,
  type ToolDocType,
} from "@/lib/toolDocumentTypes";
import {
  DocumentPreviewModal,
  type PreviewDocumentItem,
} from "@/components/DocumentPreviewModal";

interface ToolDocumentRecord {
  id: number;
  toolOrGaugeNo: string;
  toolRefNo?: number | null;
  docType: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  calibRowId?: number | null;
  dcNo?: string | null;
  remarks?: string | null;
  creatUserIdCd: string;
  creatDt: string;
}

interface StatsSummary {
  totalDocs: number;
  totalCerts: number;
  totalPhotos: number;
  totalManuals: number;
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

const ACCEPT_ATTR =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.zip,.msg,.eml,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip";

export default function DocumentsHubPage() {
  const [items, setItems] = useState<ToolDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<StatsSummary>({
    totalDocs: 0,
    totalCerts: 0,
    totalPhotos: 0,
    totalManuals: 0,
  });

  // Filter state
  const [categoryGroup, setCategoryGroup] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toolQuery, setToolQuery] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<string>("ALL");
  const [fromDt, setFromDt] = useState("");
  const [toDt, setToDt] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Lightbox / Modal state
  const [previewDoc, setPreviewDoc] = useState<PreviewDocumentItem | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Upload Form state
  const [uploadToolNo, setUploadToolNo] = useState("");
  const [uploadDcNo, setUploadDcNo] = useState("");
  const [uploadDocType, setUploadDocType] = useState<ToolDocType>("CALIB_CERTIFICATE");
  const [uploadRemarks, setUploadRemarks] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    params.set("includeStats", "1");
    if (categoryGroup && categoryGroup !== "ALL") {
      params.set("categoryGroup", categoryGroup);
    }
    if (selectedDocType && selectedDocType !== "ALL") {
      params.set("docType", selectedDocType);
    }
    if (toolQuery.trim()) {
      params.set("toolOrGaugeNo", toolQuery.trim());
    }
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (fromDt) params.set("fromDt", fromDt);
    if (toDt) params.set("toDt", toDt);

    const res = await apiGet<{
      items: ToolDocumentRecord[];
      total: number;
      stats?: StatsSummary;
    }>(`/api/tools/documents?${params.toString()}`);

    if (res.data?.items) {
      setItems(res.data.items);
      setTotalCount(res.data.total);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } else {
      setItems([]);
      setTotalCount(0);
    }
    setLoading(false);
  }, [categoryGroup, selectedDocType, toolQuery, searchQuery, fromDt, toDt]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleDelete = async (doc: ToolDocumentRecord) => {
    if (!confirm(`Are you sure you want to remove "${doc.originalName}"?`)) return;
    const res = await apiDelete<{ ok: boolean }>(`/api/tools/documents/${doc.id}`);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    toastSuccess("Document removed successfully");
    void loadData();
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

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      toastError("Please select or capture at least one file.");
      return;
    }
    if (!uploadToolNo.trim() && !uploadDcNo.trim()) {
      toastError("Tool / Gauge No or DC No is required.");
      return;
    }

    setUploading(true);
    let successCount = 0;
    try {
      for (const file of uploadFiles) {
        const form = new FormData();
        form.append("file", file);
        if (uploadToolNo.trim()) form.append("toolOrGaugeNo", uploadToolNo.trim());
        if (uploadDcNo.trim()) form.append("dcNo", uploadDcNo.trim());
        form.append("docType", uploadDocType);
        if (uploadRemarks.trim()) form.append("remarks", uploadRemarks.trim());

        const res = await fetch("/api/tools/documents", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (res.ok) {
          successCount++;
        }
      }

      toastSuccess(`Successfully uploaded ${successCount} document(s).`);
      setIsUploadOpen(false);
      setUploadFiles([]);
      setUploadRemarks("");
      void loadData();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const array = Array.from(files);
    setUploadFiles((prev) => [...prev, ...array]);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                Documents & Photos Hub
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Centralized repository for calibration certificates, setup photos, instrument condition & manuals
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate permission="canManageCalibration">
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Upload Document / Photo
                </Button>
              </RoleGate>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <ModuleKpiRow
            items={[
              {
                id: "total-docs",
                label: "Total Documents & Photos",
                value: stats.totalDocs || totalCount,
                subtext: "Archived across all instruments",
                icon: FileText,
                iconBg: "bg-[var(--primary-light)]",
                iconColor: "text-[var(--primary)]",
                badge: { label: "Repository", type: "info" },
              },
              {
                id: "calib-certs",
                label: "Calibration Certificates",
                value: stats.totalCerts,
                subtext: "Official verification certificates",
                icon: Award,
                iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
                iconColor: "text-emerald-600 dark:text-emerald-400",
                badge: { label: "Verified", type: "success" },
              },
              {
                id: "photos-media",
                label: "Photos & Media",
                value: stats.totalPhotos,
                subtext: "Tool condition & calibration setups",
                icon: ImageIcon,
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                iconColor: "text-blue-600 dark:text-blue-400",
                badge: { label: "Photos", type: "info" },
              },
              {
                id: "manuals-drawings",
                label: "Manuals & Drawings",
                value: stats.totalManuals,
                subtext: "Technical drawings & user SOPs",
                icon: BookOpen,
                iconBg: "bg-purple-50 dark:bg-purple-950/30",
                iconColor: "text-purple-600 dark:text-purple-400",
                badge: { label: "Specs", type: "info" },
              },
            ]}
          />

          {/* Category Tabs */}
          <StatusPillTabs
            className="mb-4"
            idPrefix="docs-hub-group"
            value={categoryGroup}
            onChange={(v) => {
              setCategoryGroup(v);
              setSelectedDocType("ALL");
            }}
            items={DOC_TYPE_GROUPS.map((g) => ({
              value: g.id,
              label: g.label,
            }))}
          />

          {/* Toolbar & Filters */}
          <MasterTableCard
            toolbar={
              <>
                <MasterSearchInput
                  id="docs-search"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search file, remarks, uploader…"
                  widthClass="w-56"
                />

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <input
                    type="text"
                    placeholder="Tool / Gauge No…"
                    value={toolQuery}
                    onChange={(e) => setToolQuery(e.target.value)}
                    className="h-8 text-xs font-mono border border-[var(--border-main)] rounded-lg px-2.5 outline-none focus:ring-1 focus:ring-[var(--primary-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] w-36"
                  />

                  <select
                    aria-label="Category"
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="h-8 text-xs border border-[var(--border-main)] rounded-lg px-2 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none"
                  >
                    <option value="ALL">All Types</option>
                    {TOOL_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {DOC_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    aria-label="From date"
                    className="h-8 text-xs border border-[var(--border-main)] rounded-lg px-2 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none"
                    value={fromDt}
                    onChange={(e) => setFromDt(e.target.value)}
                    title="From Date"
                  />
                  <input
                    type="date"
                    aria-label="To date"
                    className="h-8 text-xs border border-[var(--border-main)] rounded-lg px-2 bg-[var(--bg-card)] text-[var(--text-primary)] outline-none"
                    value={toDt}
                    onChange={(e) => setToDt(e.target.value)}
                    title="To Date"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 !px-2.5 text-xs"
                    onClick={() => void loadData()}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-subtle)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === "grid"
                          ? "bg-[var(--bg-card)] text-[var(--primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                      title="Gallery View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === "table"
                          ? "bg-[var(--bg-card)] text-[var(--primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                      title="Table List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            }
          >
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={6} />
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">No documents found</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                  No documents match your current filter criteria. Use the Upload button above to add calibration certificates or photos.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              /* Gallery / Grid View */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((doc) => {
                  const isImg = isImageType(doc.mimeType, doc.originalName);
                  const isPdf = isPdfType(doc.mimeType, doc.originalName);
                  const label =
                    DOC_TYPE_LABELS[doc.docType as ToolDocType] ?? doc.docType;
                  const thumbUrl = `/api/tools/documents/${doc.id}/file?inline=1`;

                  return (
                    <div
                      key={doc.id}
                      className="group rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden shadow-xs hover:shadow-md hover:border-[var(--primary)] transition-all flex flex-col"
                    >
                      {/* Thumbnail Viewport */}
                      <div
                        onClick={() => setPreviewDoc(doc)}
                        className="h-36 bg-neutral-900/90 dark:bg-black/90 relative flex items-center justify-center cursor-pointer overflow-hidden group-hover:opacity-95"
                      >
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={doc.originalName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : isPdf ? (
                          <div className="flex flex-col items-center justify-center text-red-400 gap-1.5 p-4">
                            <Award className="w-10 h-10 text-red-500" />
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider bg-red-950/60 px-2 py-0.5 rounded text-red-200">
                              PDF Certificate
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4">
                            <FileText className="w-10 h-10 text-blue-400" />
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                              Document
                            </span>
                          </div>
                        )}

                        {/* Hover Overlay Buttons */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewDoc(doc);
                            }}
                            className="p-2 rounded-xl bg-white text-slate-900 shadow-lg hover:scale-110 transition-transform"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(doc.id, doc.originalName);
                            }}
                            className="p-2 rounded-xl bg-white text-slate-900 shadow-lg hover:scale-110 transition-transform"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--primary-light)] text-[var(--primary)] truncate">
                              {label}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                              {fmtSize(doc.sizeBytes)}
                            </span>
                          </div>
                          <p
                            className="text-xs font-bold text-[var(--text-primary)] truncate"
                            title={doc.originalName}
                          >
                            {doc.originalName}
                          </p>
                          {doc.remarks && (
                            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                              {doc.remarks}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[var(--border-main)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <div className="min-w-0">
                            {doc.toolOrGaugeNo && !doc.toolOrGaugeNo.startsWith("CALIB-DC-") ? (
                              <span className="font-mono font-bold text-[var(--text-secondary)]">
                                {doc.toolOrGaugeNo}
                              </span>
                            ) : doc.dcNo ? (
                              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                DC #{doc.dcNo}
                              </span>
                            ) : (
                              <span>General</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px]">
                              {fmtDate(doc.creatDt)}
                            </span>
                            <RoleGate permission="canManageCalibration">
                              <button
                                type="button"
                                onClick={() => void handleDelete(doc)}
                                className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </RoleGate>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table List View */
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)]">
                      {[
                        "File Name",
                        "Category",
                        "Tool / Gauge No",
                        "DC / Ref",
                        "Size",
                        "Uploaded By",
                        "Upload Date",
                        "Remarks",
                        "Actions",
                      ].map((col) => (
                        <th
                          key={col}
                          className="text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-2.5 px-3"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {items.map((doc) => {
                      const label =
                        DOC_TYPE_LABELS[doc.docType as ToolDocType] ?? doc.docType;

                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <td className="py-3 px-3 max-w-[220px]">
                            <p
                              onClick={() => setPreviewDoc(doc)}
                              className="font-semibold text-xs text-[var(--text-primary)] hover:text-[var(--primary)] cursor-pointer truncate"
                              title={doc.originalName}
                            >
                              {doc.originalName}
                            </p>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--primary-light)] text-[var(--primary)]">
                              {label}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">
                            {doc.toolOrGaugeNo.startsWith("CALIB-DC-") ? "—" : doc.toolOrGaugeNo}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {doc.dcNo ? `#${doc.dcNo}` : "—"}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                            {fmtSize(doc.sizeBytes)}
                          </td>
                          <td className="py-3 px-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            {doc.creatUserIdCd}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[var(--text-muted)] whitespace-nowrap">
                            {fmtDate(doc.creatDt)}
                          </td>
                          <td className="py-3 px-3 text-xs text-[var(--text-muted)] max-w-[160px] truncate">
                            {doc.remarks || "—"}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Preview"
                                onClick={() => setPreviewDoc(doc)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Download"
                                onClick={() => handleDownload(doc.id, doc.originalName)}
                                className="p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary-light)]"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <RoleGate permission="canManageCalibration">
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={() => void handleDelete(doc)}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </RoleGate>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </MasterTableCard>
        </main>
      </div>

      {/* Lightbox / PDF In-Browser Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Upload Modal Drawer */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border-main)] shadow-2xl overflow-hidden flex flex-col my-auto">
            <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between shrink-0 bg-[var(--bg-subtle)]">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  Upload Documents & Photos
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Attach certificates, reports, or snap photos of tools & test setups
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchUpload} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Tool / Gauge No *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EM427 / PG-01"
                    value={uploadToolNo}
                    onChange={(e) => setUploadToolNo(e.target.value)}
                    className="w-full h-9 text-xs font-mono border border-[var(--border-main)] rounded-xl px-3 bg-[var(--bg-subtle)] focus:ring-2 focus:ring-[var(--primary-subtle)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    DC / Challan No (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1024"
                    value={uploadDcNo}
                    onChange={(e) => setUploadDcNo(e.target.value)}
                    className="w-full h-9 text-xs font-mono border border-[var(--border-main)] rounded-xl px-3 bg-[var(--bg-subtle)] focus:ring-2 focus:ring-[var(--primary-subtle)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Document Category *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as ToolDocType)}
                  className="w-full h-9 text-xs border border-[var(--border-main)] rounded-xl px-3 bg-[var(--bg-subtle)] focus:ring-2 focus:ring-[var(--primary-subtle)] outline-none"
                >
                  {TOOL_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Remarks / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, calibration agency, certificate details, condition notes…"
                  value={uploadRemarks}
                  onChange={(e) => setUploadRemarks(e.target.value)}
                  className="w-full text-xs border border-[var(--border-main)] rounded-xl p-3 bg-[var(--bg-subtle)] focus:ring-2 focus:ring-[var(--primary-subtle)] outline-none resize-none"
                />
              </div>

              {/* Drag & Drop File Zone */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                  Select Files or Snap Photo
                </label>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-main)] hover:border-[var(--primary)] rounded-2xl p-5 text-center cursor-pointer bg-[var(--bg-subtle)] transition-colors"
                >
                  <div className="flex justify-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!uploadDocType.includes("PHOTO")) {
                          setUploadDocType("CALIB_PHOTO");
                        }
                        cameraInputRef.current?.click();
                      }}
                      className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:scale-105 flex items-center justify-center transition-transform"
                      title="Take photo using camera"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    Click to choose files or take photo
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Supports PDF certificates, JPG, PNG, DOCX, XLSX (up to 10 MB each)
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => onFilesSelected(e.target.files)}
                />

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onFilesSelected(e.target.files)}
                />
              </div>

              {/* Staged file list */}
              {uploadFiles.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Files to upload ({uploadFiles.length}):
                  </p>
                  {uploadFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-xs border border-[var(--border-main)]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                          ({fmtSize(file.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setUploadFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[var(--text-muted)] hover:text-red-500 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border-main)] flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={uploading || uploadFiles.length === 0}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading…" : `Upload ${uploadFiles.length} File(s)`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
