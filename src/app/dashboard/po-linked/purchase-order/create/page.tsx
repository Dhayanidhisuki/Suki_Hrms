"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";
import { apiGet, apiPost } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/appToast";
import { useSession } from "@/lib/SessionContext";

type SupplierOpt = { supCode: string; supName: string | null };
type GoodsType = { goodsType: string; poPrefix: string };
type LedgerOpt = { code: string; ledgerName: string | null };
type LineDraft = {
  key: string;
  toolOrGaugeNo: string;
  toolName: string;
  qty: string;
  rate: string;
  uom: string;
  rateSource: "pricing" | "manual" | "";
  expLedgerCode: string;
  budgetCode: string;
};

function newLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    toolOrGaugeNo: "",
    toolName: "",
    qty: "1",
    rate: "",
    uom: "Nos",
    rateSource: "",
    expLedgerCode: "",
    budgetCode: "",
  };
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const { can, loading: sessionLoading } = useSession();
  const allowed = can("canCreatePO");

  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [goodsTypes, setGoodsTypes] = useState<GoodsType[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOpt[]>([]);
  const [supCode, setSupCode] = useState("");
  const [goodsType, setGoodsType] = useState("GENERAL CONSUMABLES");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [toolQuery, setToolQuery] = useState<Record<string, string>>({});
  const [toolHits, setToolHits] = useState<
    Record<string, Array<{ toolOrGaugeNo: string; name: string | null }>>
  >({});

  useEffect(() => {
    void (async () => {
      const [supRes, gtRes, glRes] = await Promise.all([
        apiGet<{ items?: SupplierOpt[] }>("/api/suppliers?pageSize=500"),
        apiGet<{ items?: GoodsType[] }>("/api/po/goods-types"),
        apiGet<{ items?: LedgerOpt[] }>("/api/gl-codes?pageSize=300"),
      ]);
      setSuppliers(supRes.data?.items ?? []);
      setLedgers(glRes.data?.items ?? []);
      const gts = gtRes.data?.items ?? [];
      setGoodsTypes(gts);
      if (gts.some((g) => g.goodsType === "GENERAL CONSUMABLES")) {
        setGoodsType("GENERAL CONSUMABLES");
      } else if (gts[0]) {
        setGoodsType(gts[0].goodsType);
      }
    })();
  }, []);

  const prefixHint = useMemo(() => {
    return goodsTypes.find((g) => g.goodsType === goodsType)?.poPrefix ?? "—";
  }, [goodsTypes, goodsType]);

  const searchTools = useCallback(async (key: string, q: string) => {
    setToolQuery((prev) => ({ ...prev, [key]: q }));
    // Typing invalidates a prior pick until they choose again
    setLines((prev) =>
      prev.map((l) =>
        l.key === key && l.toolOrGaugeNo && l.toolOrGaugeNo !== q.trim()
          ? { ...l, toolOrGaugeNo: "", toolName: "", rateSource: "", rate: "" }
          : l
      )
    );
    if (q.trim().length < 2) {
      setToolHits((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    const res = await apiGet<{
      items?: Array<{ toolOrGaugeNo: string; name: string | null }>;
    }>(`/api/tools?search=${encodeURIComponent(q.trim())}&pageSize=20`);
    setToolHits((prev) => ({ ...prev, [key]: res.data?.items ?? [] }));
  }, []);

  const pickTool = async (key: string, toolOrGaugeNo: string, name: string | null) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, toolOrGaugeNo, toolName: name ?? "", rateSource: "" }
          : l
      )
    );
    setToolHits((prev) => ({ ...prev, [key]: [] }));
    setToolQuery((prev) => ({ ...prev, [key]: toolOrGaugeNo }));

    const qs = new URLSearchParams({ toolOrGaugeNo });
    if (supCode) qs.set("supCode", supCode);
    const res = await apiGet<{ rate: number | null; tool?: { uom?: string } }>(
      `/api/po/tool-rate?${qs}`
    );
    if (res.data?.rate != null) {
      setLines((prev) =>
        prev.map((l) =>
          l.key === key
            ? {
                ...l,
                rate: String(res.data!.rate),
                uom: res.data?.tool?.uom || l.uom || "Nos",
                rateSource: "pricing",
              }
            : l
        )
      );
    }
  };

  /** Resolve typed text to a master tool (exact no, else single search hit). */
  const resolveToolFromQuery = useCallback(
    async (
      q: string
    ): Promise<{ toolOrGaugeNo: string; name: string | null } | null> => {
      const typed = q.trim();
      if (!typed) return null;
      const res = await apiGet<{
        items?: Array<{ toolOrGaugeNo: string; name: string | null }>;
      }>(`/api/tools?search=${encodeURIComponent(typed)}&pageSize=20`);
      const items = res.data?.items ?? [];
      const exact = items.find(
        (t) => (t.toolOrGaugeNo ?? "").toUpperCase() === typed.toUpperCase()
      );
      if (exact?.toolOrGaugeNo) {
        return { toolOrGaugeNo: exact.toolOrGaugeNo, name: exact.name };
      }
      if (items.length === 1 && items[0]?.toolOrGaugeNo) {
        return { toolOrGaugeNo: items[0].toolOrGaugeNo, name: items[0].name };
      }
      return null;
    },
    []
  );

  const tryResolveLine = useCallback(
    async (key: string) => {
      const line = lines.find((l) => l.key === key);
      if (!line) return;
      if (line.toolOrGaugeNo.trim()) return;
      const typed = (toolQuery[key] ?? "").trim();
      if (typed.length < 2) return;
      const hits = toolHits[key] ?? [];
      const fromHits =
        hits.find((t) => (t.toolOrGaugeNo ?? "").toUpperCase() === typed.toUpperCase()) ??
        (hits.length === 1 ? hits[0] : null);
      if (fromHits?.toolOrGaugeNo) {
        await pickTool(key, fromHits.toolOrGaugeNo, fromHits.name);
        return;
      }
      const resolved = await resolveToolFromQuery(typed);
      if (resolved) {
        await pickTool(key, resolved.toolOrGaugeNo, resolved.name);
      }
    },
    [lines, toolQuery, toolHits, resolveToolFromQuery]
  );

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const q = Number(l.qty);
      const r = Number(l.rate);
      if (!Number.isFinite(q) || !Number.isFinite(r)) return sum;
      return sum + q * r;
    }, 0);
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supCode) {
      toastError("Select a supplier");
      return;
    }

    // Resolve any typed-but-not-clicked tool searches before validating
    const resolvedLines: LineDraft[] = [];
    for (const line of lines) {
      let next = line;
      if (!line.toolOrGaugeNo.trim()) {
        const typed = (toolQuery[line.key] ?? "").trim();
        if (typed) {
          const resolved = await resolveToolFromQuery(typed);
          if (resolved) {
            next = {
              ...line,
              toolOrGaugeNo: resolved.toolOrGaugeNo,
              toolName: resolved.name ?? "",
            };
            await pickTool(line.key, resolved.toolOrGaugeNo, resolved.name);
          }
        }
      }
      resolvedLines.push(next);
    }

    const pendingTyped = resolvedLines.filter((l) => {
      const typed = (toolQuery[l.key] ?? "").trim();
      return !l.toolOrGaugeNo.trim() && typed.length > 0;
    });
    if (pendingTyped.length > 0) {
      toastError(
        "Select a tool from the search results (click a match). Typed text alone is not enough."
      );
      return;
    }

    const payloadLines = resolvedLines
      .filter((l) => l.toolOrGaugeNo.trim())
      .map((l) => ({
        toolOrGaugeNo: l.toolOrGaugeNo.trim(),
        qty: Number(l.qty),
        rate: l.rate === "" ? undefined : Number(l.rate),
        uom: l.uom || "Nos",
        expLedgerCode: l.expLedgerCode.trim() || null,
        budgetCode: l.budgetCode.trim() || null,
      }));
    if (payloadLines.length === 0) {
      toastError("Add at least one tool line — search and click a tool from the list");
      return;
    }
    for (const l of payloadLines) {
      if (!Number.isFinite(l.qty) || l.qty <= 0) {
        toastError(`Invalid qty for ${l.toolOrGaugeNo}`);
        return;
      }
    }

    setSaving(true);
    const res = await apiPost<{ ok: boolean; po?: { poOrderNo: string } }>("/api/po", {
      supCode,
      poDate,
      goodsType,
      remarks: remarks.trim() || null,
      lines: payloadLines,
    });
    setSaving(false);
    if (res.error) {
      toastError(res.error.message);
      return;
    }
    const poNo = res.data?.po?.poOrderNo ?? "";
    toastSuccess(poNo ? `PO ${poNo} created` : "PO created");
    router.push(
      poNo
        ? `/dashboard/po-linked/purchase-order?search=${encodeURIComponent(poNo)}`
        : "/dashboard/po-linked/purchase-order"
    );
  };

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-screen bg-[var(--bg-app)]">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="p-7">
            <p className="text-sm text-[var(--text-muted)]">
              You do not have permission to create purchase orders (
              <span className="font-mono">canCreatePO</span>).
            </p>
            <Link href="/dashboard/po-linked/purchase-order" className="text-[var(--primary)] text-sm font-semibold">
              ← Back to PO list
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Link
                href="/dashboard/po-linked/purchase-order"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to list
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Create Purchase Order</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Writes to <span className="font-mono text-xs">COMMON_PURCHASE_ORDER</span> using ERP
                numbering (<span className="font-mono text-xs">{prefixHint}</span>…)
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl">
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Supplier</label>
                <select
                  className="form-control"
                  value={supCode}
                  required
                  onChange={(e) => setSupCode(e.target.value)}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.supCode} value={s.supCode}>
                      {s.supCode} — {s.supName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Goods type (PO series)</label>
                <select
                  className="form-control"
                  value={goodsType}
                  onChange={(e) => setGoodsType(e.target.value)}
                >
                  {goodsTypes.map((g) => (
                    <option key={g.goodsType} value={g.goodsType}>
                      {g.goodsType} ({g.poPrefix})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">PO date</label>
                <input
                  type="date"
                  className="form-control"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Remarks</label>
                <input
                  className="form-control"
                  value={remarks}
                  maxLength={300}
                  placeholder="Optional"
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-main)] flex items-center justify-between">
                <h2 className="text-sm font-semibold">Line items</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="w-3.5 h-3.5" /> Add line
                </Button>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm min-w-[960px]">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-main)]">
                      {["Tool", "Qty", "Rate", "UOM", "Exp ledger", "Budget", ""].map((h) => (
                        <th
                          key={h || "x"}
                          className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-main)]">
                    {lines.map((line) => (
                      <tr key={line.key}>
                        <td className="py-2 px-3 align-top relative">
                          <input
                            className="form-control font-mono text-xs"
                            placeholder="Search tool no or name…"
                            value={toolQuery[line.key] ?? line.toolOrGaugeNo}
                            onChange={(e) => void searchTools(line.key, e.target.value)}
                            onBlur={() => {
                              // Allow click on dropdown to fire first
                              window.setTimeout(() => void tryResolveLine(line.key), 150);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const first = (toolHits[line.key] ?? [])[0];
                                if (first?.toolOrGaugeNo) {
                                  void pickTool(line.key, first.toolOrGaugeNo, first.name);
                                } else {
                                  void tryResolveLine(line.key);
                                }
                              }
                            }}
                          />
                          {line.toolOrGaugeNo ? (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 truncate max-w-xs">
                              Selected: {line.toolOrGaugeNo}
                              {line.toolName ? ` · ${line.toolName}` : ""}
                              {line.rateSource === "pricing" ? " · rate from Pricing Master" : ""}
                            </p>
                          ) : (toolQuery[line.key] ?? "").trim().length >= 2 ? (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                              {(toolHits[line.key] ?? []).length === 0
                                ? "No matches — try another tool no (e.g. OTH_J… or LAP-…)"
                                : "Click a match below (or press Enter for the first result)"}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">
                              Type at least 2 characters, then pick from the list
                            </p>
                          )}
                          {(toolHits[line.key] ?? []).length > 0 && !line.toolOrGaugeNo && (
                            <div className="absolute z-20 left-3 right-3 mt-1 max-h-40 overflow-auto rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] shadow-lg">
                              {(toolHits[line.key] ?? []).map((t) => (
                                <button
                                  key={t.toolOrGaugeNo}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)]"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() =>
                                    void pickTool(line.key, t.toolOrGaugeNo, t.name)
                                  }
                                >
                                  <span className="font-mono font-semibold">{t.toolOrGaugeNo}</span>
                                  <span className="text-[var(--text-muted)]"> · {t.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 align-top w-24">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="form-control font-mono text-xs"
                            value={line.qty}
                            onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                            required
                          />
                        </td>
                        <td className="py-2 px-3 align-top w-32">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="form-control font-mono text-xs"
                            value={line.rate}
                            onChange={(e) =>
                              updateLine(line.key, {
                                rate: e.target.value,
                                rateSource: "manual",
                              })
                            }
                            placeholder="Auto"
                          />
                        </td>
                        <td className="py-2 px-3 align-top w-24">
                          <input
                            className="form-control text-xs"
                            value={line.uom}
                            maxLength={10}
                            onChange={(e) => updateLine(line.key, { uom: e.target.value })}
                          />
                        </td>
                        <td className="py-2 px-3 align-top w-48">
                          <select
                            className="form-control text-xs"
                            value={line.expLedgerCode}
                            onChange={(e) =>
                              updateLine(line.key, { expLedgerCode: e.target.value })
                            }
                          >
                            <option value="">— Optional —</option>
                            {ledgers.map((g) => (
                              <option key={g.code} value={g.code}>
                                {g.code}
                                {g.ledgerName ? ` · ${g.ledgerName}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 align-top w-36">
                          <input
                            className="form-control font-mono text-xs"
                            value={line.budgetCode}
                            maxLength={50}
                            placeholder="Optional"
                            onChange={(e) =>
                              updateLine(line.key, { budgetCode: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-2 px-3 align-top w-12">
                          <button
                            type="button"
                            title="Remove"
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((prev) => prev.filter((l) => l.key !== line.key))
                            }
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border-main)] flex justify-between items-center">
                <p className="text-xs text-[var(--text-muted)]">
                  Subtotal{" "}
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Link href="/dashboard/po-linked/purchase-order">
                    <Button type="button" variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? "Creating…" : "Create PO"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
