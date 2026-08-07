import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { loadEsskayPricing } from "@/lib/esskayPricing";

export type ApprovalSource =
  | "supplier"
  | "subcontractor"
  | "tool_pricing"
  | "purchase_approval"
  | "purchase_order";

export type ApprovalStatus = "Approved" | "Pending" | "Rejected" | "Unknown";

export type ApprovalItem = {
  id: string;
  source: ApprovalSource;
  sourceLabel: string;
  ref: string;
  title: string;
  status: ApprovalStatus;
  statusRaw: string;
  date: string | null;
  detail?: string;
  href?: string;
};

function yesNoStatus(raw: string | null | undefined): ApprovalStatus {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v || v === "N/A" || v === "-" || v === "NULL") return "Pending";
  if (v === "YES" || v === "Y" || v === "1" || v === "TRUE" || v === "APPROVED") return "Approved";
  if (v === "NO" || v === "N" || v === "0" || v === "FALSE" || v === "REJECTED" || v === "REJECT")
    return "Rejected";
  if (v.includes("PEND") || v.includes("WAIT") || v.includes("DRAFT")) return "Pending";
  if (v.includes("APPROV")) return "Approved";
  if (v.includes("REJECT")) return "Rejected";
  return "Unknown";
}

function textStatus(raw: string | null | undefined): ApprovalStatus {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return "Pending";
  if (v.includes("REJECT") || v.includes("CANCEL") || v.includes("DENY")) return "Rejected";
  if (v.includes("APPROV") || v === "OK" || v === "ACTIVE" || v === "CLOSED") return "Approved";
  if (v.includes("PEND") || v.includes("WAIT") || v.includes("DRAFT") || v.includes("OPEN") || v.includes("SUBMIT"))
    return "Pending";
  return yesNoStatus(raw);
}

function poApprovalStatus(cd: number | null | undefined, approver?: string | null): ApprovalStatus {
  if (cd === 4) return "Rejected";
  if (cd === 3 || cd === 5) return "Approved";
  if (cd === 0 || cd === 1 || cd === 2) return "Pending";
  if ((approver ?? "").trim()) return "Approved";
  return "Unknown";
}

function poStatusLabel(cd: number | null | undefined): string {
  if (cd == null) return "—";
  const map: Record<number, string> = {
    0: "Draft",
    1: "Open",
    2: "Partial",
    3: "Closed",
    4: "Cancelled",
    5: "Approved",
  };
  return map[cd] ?? `Status ${cd}`;
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") return d.includes("T") ? d.split("T")[0]! : d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Aggregate existing ERP approval flags — no Tools-owned approval table. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const sp = req.nextUrl.searchParams;
  const sourceFilter = (sp.get("source") || "all").trim().toLowerCase();
  const statusFilter = (sp.get("status") || "all").trim().toLowerCase();
  const search = (sp.get("search") || "").trim().toLowerCase();
  const limitPerSource = Math.min(200, Math.max(20, Number(sp.get("limit") || 100)));

  const items: ApprovalItem[] = [];
  const errors: string[] = [];

  // 1) Suppliers — APPROVED_SUPPLIER
  if (sourceFilter === "all" || sourceFilter === "supplier") {
    try {
      const rows = await prisma.supplier.findMany({
        take: limitPerSource,
        orderBy: { creatDt: "desc" },
        select: {
          supCode: true,
          supName: true,
          approvedSupplier: true,
          creatDt: true,
          status: true,
        },
      });
      for (const s of rows) {
        items.push({
          id: `supplier:${s.supCode}`,
          source: "supplier",
          sourceLabel: "Supplier",
          ref: s.supCode,
          title: s.supName?.trim() || s.supCode,
          status: yesNoStatus(s.approvedSupplier),
          statusRaw: s.approvedSupplier?.trim() || "—",
          date: iso(s.creatDt),
          detail: s.status ? `ERP status: ${s.status}` : undefined,
          href: "/dashboard/masters/suppliers",
        });
      }
    } catch (e) {
      errors.push(`supplier: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // 2) Subcontractors — APPROVED_SUBCONTRACTOR
  if (sourceFilter === "all" || sourceFilter === "subcontractor") {
    try {
      const rows = await prisma.subcontractor.findMany({
        take: limitPerSource,
        orderBy: { creatDt: "desc" },
        select: {
          subConId: true,
          subName: true,
          approvedSubcontractor: true,
          creatDt: true,
          status: true,
        },
      });
      for (const s of rows) {
        items.push({
          id: `subcontractor:${s.subConId}`,
          source: "subcontractor",
          sourceLabel: "Subcontractor",
          ref: s.subConId,
          title: s.subName?.trim() || s.subConId,
          status: yesNoStatus(s.approvedSubcontractor),
          statusRaw: s.approvedSubcontractor?.trim() || "—",
          date: iso(s.creatDt),
          detail: s.status ? `ERP status: ${s.status}` : undefined,
          href: "/dashboard/masters/subcontractors",
        });
      }
    } catch (e) {
      errors.push(`subcontractor: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // 3) Tool pricing — APPROVAL_STATUS (DB), fallback ESSKAY JSON export
  if (sourceFilter === "all" || sourceFilter === "tool_pricing") {
    try {
      const rows = await prisma.toolsPriceMaster.findMany({
        take: limitPerSource,
        orderBy: { creatDt: "desc" },
        select: {
          rowId: true,
          supCode: true,
          toolRefNo: true,
          approvalStatus: true,
          approvalDate: true,
          rate: true,
          creatDt: true,
          tool: { select: { toolOrGaugeNo: true, name: true } },
        },
      });

      if (rows.length > 0 && rows.some((r) => r.approvalStatus != null && r.approvalStatus !== "")) {
        for (const r of rows) {
          const toolNo = r.tool?.toolOrGaugeNo || (r.toolRefNo != null ? `#${r.toolRefNo}` : "—");
          items.push({
            id: `tool_pricing:${r.rowId}`,
            source: "tool_pricing",
            sourceLabel: "Tool pricing",
            ref: String(r.rowId),
            title: `${toolNo} · ${r.supCode || "—"}`,
            status: textStatus(r.approvalStatus),
            statusRaw: r.approvalStatus?.trim() || "—",
            date: iso(r.approvalDate) || iso(r.creatDt),
            detail:
              r.rate != null
                ? `Rate ${Number(r.rate).toLocaleString("en-IN")} · ${r.tool?.name || ""}`.trim()
                : r.tool?.name || undefined,
            href: "/dashboard/masters/pricing",
          });
        }
      } else {
        const file = await loadEsskayPricing();
        for (const r of file.items.slice(0, limitPerSource)) {
          items.push({
            id: `tool_pricing:esskay:${r.rowId}`,
            source: "tool_pricing",
            sourceLabel: "Tool pricing",
            ref: String(r.rowId),
            title: `${r.toolOrGaugeNo || `#${r.toolRefNo ?? "—"}`} · ${r.supCode || "—"}`,
            status: textStatus(r.approvalStatus),
            statusRaw: r.approvalStatus?.trim() || "—",
            date: r.approvalDate ? iso(r.approvalDate) : r.creatDt ? iso(r.creatDt) : null,
            detail: r.rate != null ? `Rate ${r.rate} (${file.source})` : file.source,
            href: "/dashboard/masters/pricing",
          });
        }
      }
    } catch (e) {
      errors.push(`tool_pricing: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // 4) PURCHASE_APPROVAL trail
  if (sourceFilter === "all" || sourceFilter === "purchase_approval") {
    try {
      if (prisma.purchaseApproval?.findMany) {
        const rows = await prisma.purchaseApproval.findMany({
          take: limitPerSource,
          orderBy: { creatDt: "desc" },
        });
        for (const r of rows) {
          const status =
            r.curStatusCd >= 5
              ? ("Approved" as const)
              : r.curStatusCd === 4
                ? ("Rejected" as const)
                : ("Pending" as const);
          items.push({
            id: `purchase_approval:${r.refNo}`,
            source: "purchase_approval",
            sourceLabel: "Purchase approval",
            ref: r.poOrderNo || String(r.refNo),
            title: r.poOrderNo ? `PO ${r.poOrderNo}` : `Approval #${r.refNo}`,
            status,
            statusRaw: `${r.prevStatusCd} → ${r.curStatusCd}`,
            date: iso(r.creatDt) || iso(r.lstUpdtTs),
            detail: r.comments || undefined,
            href: "/dashboard/po-linked/purchase-order",
          });
        }
      }
    } catch (e) {
      errors.push(`purchase_approval: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  // 5) COMMON_PURCHASE_ORDER header status / approver
  if (sourceFilter === "all" || sourceFilter === "purchase_order") {
    try {
      if (prisma.commonPurchaseOrder?.findMany) {
        const rows = await prisma.commonPurchaseOrder.findMany({
          take: limitPerSource,
          orderBy: { poDate: "desc" },
          select: {
            poOrderNo: true,
            poDate: true,
            orderStatusCd: true,
            approverCd: true,
            supCode: true,
            supplier: { select: { supName: true } },
          },
        });
        for (const r of rows) {
          items.push({
            id: `purchase_order:${r.poOrderNo}`,
            source: "purchase_order",
            sourceLabel: "Purchase order",
            ref: r.poOrderNo,
            title: r.supplier?.supName
              ? `${r.poOrderNo} · ${r.supplier.supName}`
              : r.poOrderNo,
            status: poApprovalStatus(r.orderStatusCd, r.approverCd),
            statusRaw: poStatusLabel(r.orderStatusCd),
            date: iso(r.poDate),
            detail: r.approverCd ? `Approver: ${r.approverCd}` : r.supCode || undefined,
            href: `/dashboard/po-linked/purchase-order`,
          });
        }
      }
    } catch (e) {
      errors.push(`purchase_order: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  let filtered = items;
  if (statusFilter !== "all") {
    filtered = filtered.filter((i) => i.status.toLowerCase() === statusFilter);
  }
  if (search) {
    filtered = filtered.filter(
      (i) =>
        i.ref.toLowerCase().includes(search) ||
        i.title.toLowerCase().includes(search) ||
        i.sourceLabel.toLowerCase().includes(search) ||
        (i.detail ?? "").toLowerCase().includes(search) ||
        i.statusRaw.toLowerCase().includes(search)
    );
  }

  filtered.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    return db.localeCompare(da);
  });

  const counts = {
    total: filtered.length,
    approved: filtered.filter((i) => i.status === "Approved").length,
    pending: filtered.filter((i) => i.status === "Pending").length,
    rejected: filtered.filter((i) => i.status === "Rejected").length,
    bySource: {
      supplier: filtered.filter((i) => i.source === "supplier").length,
      subcontractor: filtered.filter((i) => i.source === "subcontractor").length,
      tool_pricing: filtered.filter((i) => i.source === "tool_pricing").length,
      purchase_approval: filtered.filter((i) => i.source === "purchase_approval").length,
      purchase_order: filtered.filter((i) => i.source === "purchase_order").length,
    },
  };

  return NextResponse.json({
    items: filtered,
    counts,
    readOnly: true,
    note: "Aggregated from existing ERP tables — no Tools approval table created.",
    errors: errors.length ? errors : undefined,
  });
}
