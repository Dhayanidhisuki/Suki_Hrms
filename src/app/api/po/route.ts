import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";

/** Read-only list of shared ERP purchase orders (COMMON_PURCHASE_ORDER). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") || 50)));
  const search = (sp.get("search") || "").trim();
  const supCode = (sp.get("supCode") || "").trim();
  const fromDate = (sp.get("fromDate") || "").trim();
  const toDate = (sp.get("toDate") || "").trim();
  const toolsOnly = sp.get("toolsOnly") === "1" || sp.get("toolsOnly") === "true";

  const where: Prisma.CommonPurchaseOrderWhereInput = {};

  if (search) {
    where.OR = [
      { poOrderNo: { contains: search } },
      { supCode: { contains: search } },
      { remarks: { contains: search } },
      { contactName: { contains: search } },
      { supplier: { is: { supName: { contains: search } } } },
    ];
  }
  if (supCode && supCode !== "ALL") {
    where.supCode = supCode;
  }
  if (fromDate || toDate) {
    where.poDate = {};
    if (fromDate) where.poDate.gte = new Date(`${fromDate}T00:00:00`);
    if (toDate) where.poDate.lte = new Date(`${toDate}T23:59:59`);
  }
  if (toolsOnly) {
    where.lines = { some: { toolRefNo: { not: null } } };
  }

  const po = prisma.commonPurchaseOrder;
  if (!po?.count || !po?.findMany) {
    return NextResponse.json(
      {
        error:
          "Prisma client is missing CommonPurchaseOrder. Restart the Next.js dev server after prisma generate.",
      },
      { status: 503 }
    );
  }

  try {
    const [total, rows] = await Promise.all([
      po.count({ where }),
      po.findMany({
        where,
        orderBy: [{ poDate: "desc" }, { poOrderNo: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { supCode: true, supName: true } },
          lines: {
            orderBy: { rowId: "asc" },
            include: {
              tool: { select: { refNo: true, toolOrGaugeNo: true, name: true } },
            },
          },
        },
      }),
    ]);

    const items = rows.map((po) => {
      const lines = po.lines ?? [];
      const lineCount = lines.length;
      const toolLineCount = lines.filter((l) => l.toolRefNo != null).length;
      const amount = lines.reduce((sum, l) => {
        const qty = Number(l.qty ?? 0);
        const price = Number(l.price ?? 0);
        return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
      }, 0);
      const headerValue = po.purchaseValue != null ? Number(po.purchaseValue) : null;

      return {
        poOrderNo: po.poOrderNo,
        poDate: po.poDate,
        validTill: po.validTill,
        orderStatusCd: po.orderStatusCd,
        statusLabel: statusLabel(po.orderStatusCd),
        supCode: po.supCode,
        supplier: po.supplier,
        purchaseType: po.purchaseType,
        poCat: po.poCat,
        poGoodsType: po.poGoodsType,
        currency: po.currency ?? "INR",
        lobType: po.lobType,
        vendorType: po.vendorType,
        department: po.department,
        contactName: po.contactName,
        remarks: po.remarks,
        purchaseValue: headerValue,
        lineCount,
        toolLineCount,
        amount: headerValue != null && Number.isFinite(headerValue) ? headerValue : amount,
        lines: lines.map((l) => ({
          rowId: l.rowId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          itemDesc: l.itemDesc,
          itemType: l.itemType,
          qty: l.qty != null ? Number(l.qty) : null,
          price: l.price != null ? Number(l.price) : null,
          uom: l.uom,
          toolRefNo: l.toolRefNo,
          tool: l.tool,
        })),
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      source: "COMMON_PURCHASE_ORDER",
      readOnly: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load purchase orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function statusLabel(cd: number | null | undefined): string {
  if (cd == null) return "—";
  // Common ERP status codes vary by site; show code with a few known labels.
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
