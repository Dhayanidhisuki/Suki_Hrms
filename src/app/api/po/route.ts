import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { checkLegacyPermission } from "@/lib/rbac";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";
import { PurchaseOrderCreateSchema } from "@/lib/validators";
import {
  allocateItemRowIds,
  allocateNextPoOrderNo,
  resolvePoPrefix,
} from "@/lib/poNumbering";

function statusLabel(cd: number | null | undefined): string {
  if (cd == null) return "—";
  const map: Record<number, string> = {
    0: "Draft",
    1: "Open",
    2: "Partial",
    3: "Closed",
    4: "Cancelled",
    5: "Approved",
    10: "Submitted",
    20: "Approved",
    40: "Partial",
    50: "Closed",
    70: "Cancelled",
  };
  return map[cd] ?? `Status ${cd}`;
}

async function creatUserCode(session: {
  userId: string;
  userDbId: number | null;
}): Promise<string> {
  if (session.userDbId != null) {
    const u = await prisma.user.findUnique({
      where: { id: session.userDbId },
      select: { erpUserCode: true },
    });
    if (u?.erpUserCode?.trim()) return u.erpUserCode.trim().slice(0, 10);
  }
  return session.userId.slice(0, 10);
}

/** Prefer approved live RATE for tool (+ optional supplier). */
async function lookupApprovedRate(
  toolRefNo: number,
  supCode: string
): Promise<number | null> {
  const rows = await prisma.toolsPriceMaster.findMany({
    where: {
      toolRefNo,
      OR: [
        { approvalStatus: null },
        { approvalStatus: "" },
        { approvalStatus: { equals: "APPROVED" } },
        { approvalStatus: { equals: "Approved" } },
        { approvalStatus: { equals: "Yes" } },
      ],
    },
    orderBy: [{ creatDt: "desc" }, { rowId: "desc" }],
    take: 20,
    select: { rate: true, proposedRate: true, approvalStatus: true, supCode: true },
  });
  const withRate = rows.filter((r) => r.rate != null);
  const matchSup = withRate.find(
    (r) => (r.supCode ?? "").trim().toUpperCase() === supCode.trim().toUpperCase()
  );
  const pick = matchSup ?? withRate[0];
  return pick?.rate != null ? Number(pick.rate) : null;
}

/** Read list of shared ERP purchase orders (COMMON_PURCHASE_ORDER). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const unitScope = await resolveUnitScope(check.session);

  const canCreate = await checkLegacyPermission(check.session, "canCreatePO");

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
    const canUpdateFinance = await checkLegacyPermission(check.session, "canUpdateFinance");

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
                tool: { select: { refNo: true, toolOrGaugeNo: true, name: true, locationName: true } },
            },
          },
        },
      }),
    ]);

    const scopedRows = unitScope.unrestricted
      ? rows
      : rows.filter((row) => row.lines.some((line) => unitIsAllowed(unitScope, line.tool?.locationName)));
    const poNos = scopedRows.map((r) => r.poOrderNo);
    const financeRows =
      poNos.length > 0
        ? await prisma.toolsPoFinance.findMany({
            where: { poOrderNo: { in: poNos } },
            include: { lines: true },
          })
        : [];
    const financeByPo = new Map(financeRows.map((f) => [f.poOrderNo, f]));

    const items = scopedRows.map((row) => {
      const lines = row.lines ?? [];
      const lineCount = lines.length;
      const toolLineCount = lines.filter((l) => l.toolRefNo != null).length;
      const amount = lines.reduce((sum, l) => {
        const qty = Number(l.qty ?? 0);
        const price = Number(l.price ?? 0);
        return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
      }, 0);
      const headerValue = row.purchaseValue != null ? Number(row.purchaseValue) : null;
      const finance = financeByPo.get(row.poOrderNo);
      const finLineByItem = new Map(
        (finance?.lines ?? []).map((fl) => [fl.poItemRowId, fl])
      );

      return {
        poOrderNo: row.poOrderNo,
        poDate: row.poDate,
        validTill: row.validTill,
        orderStatusCd: row.orderStatusCd,
        statusLabel: statusLabel(row.orderStatusCd),
        supCode: row.supCode,
        supplier: row.supplier,
        purchaseType: row.purchaseType,
        poCat: row.poCat,
        poGoodsType: row.poGoodsType,
        currency: row.currency ?? "INR",
        lobType: row.lobType,
        vendorType: row.vendorType,
        department: row.department,
        contactName: row.contactName,
        remarks: row.remarks,
        purchaseValue: headerValue,
        lineCount,
        toolLineCount,
        amount: headerValue != null && Number.isFinite(headerValue) ? headerValue : amount,
        paymentStatus: finance?.paymentStatus ?? null,
        paymentDate: finance?.paymentDate ?? null,
        financeRemarks: finance?.remarks ?? null,
        lines: lines.map((l) => {
          const fl = finLineByItem.get(l.rowId);
          return {
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
            expLedgerCode: fl?.expLedgerCode ?? null,
            budgetCode: fl?.budgetCode ?? null,
          };
        }),
      };
    });

    return NextResponse.json({
      items,
      total: unitScope.unrestricted ? total : scopedRows.length,
      page,
      pageSize,
      source: "COMMON_PURCHASE_ORDER",
      readOnly: !canCreate,
      canCreate,
      canUpdateFinance,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load purchase orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/po — create COMMON_PURCHASE_ORDER + COMMON_PURCHASE_ITEM using ERP numbering.
 * Does not special-case GRN/schedule — they already accept free-text PO#.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canCreatePO");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json().catch(() => null);
  const parsed = PurchaseOrderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const supplier = await prisma.supplier.findUnique({
    where: { supCode: data.supCode },
    select: { supCode: true, status: true },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
  }

  const toolNos = data.lines.map((l) => l.toolOrGaugeNo);
  const tools = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: toolNos } },
    select: {
      refNo: true,
      toolOrGaugeNo: true,
      name: true,
      description: true,
      type: true,
    },
  });
  const toolMap = new Map(tools.map((t) => [t.toolOrGaugeNo, t]));
  for (const line of data.lines) {
    if (!toolMap.has(line.toolOrGaugeNo)) {
      return NextResponse.json(
        { error: `Tool not found: ${line.toolOrGaugeNo}` },
        { status: 400 }
      );
    }
  }

  const { goodsType, prefix } = await resolvePoPrefix(data.goodsType);
  const creatUser = await creatUserCode(authCheck.session);
  const now = data.poDate ? new Date(data.poDate) : new Date();
  const validTill = data.validTill ? new Date(data.validTill) : null;

  const ledgerCodes = [
    ...new Set(
      data.lines
        .map((l) => l.expLedgerCode?.trim())
        .filter((c): c is string => Boolean(c))
    ),
  ];
  if (ledgerCodes.length > 0) {
    const found = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
      `
      SELECT LTRIM(RTRIM(CODE)) AS code
      FROM dbo.FINANCE_LEDGER_MASTER
      WHERE LTRIM(RTRIM(CODE)) IN (${ledgerCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")})
      `
    );
    const foundSet = new Set(found.map((r) => r.code));
    for (const code of ledgerCodes) {
      if (!foundSet.has(code)) {
        return NextResponse.json(
          { error: `Unknown expense ledger code: ${code}` },
          { status: 400 }
        );
      }
    }
  }

  const lineRates: number[] = [];
  for (const line of data.lines) {
    const tool = toolMap.get(line.toolOrGaugeNo)!;
    let rate = line.rate;
    if (rate == null || !Number.isFinite(rate)) {
      const looked = await lookupApprovedRate(tool.refNo, data.supCode);
      if (looked == null) {
        return NextResponse.json(
          {
            error: `No approved price for ${line.toolOrGaugeNo} — enter rate or approve Pricing Master first`,
          },
          { status: 400 }
        );
      }
      rate = looked;
    }
    lineRates.push(rate);
  }

  const subTot = data.lines.reduce(
    (sum, line, i) => sum + line.qty * lineRates[i]!,
    0
  );

  const hasLineFinance = data.lines.some(
    (l) => l.expLedgerCode?.trim() || l.budgetCode?.trim()
  );

  try {
    const created = await prisma.$transaction(async (tx) => {
      const poOrderNo = await allocateNextPoOrderNo(tx, prefix);
      const rowIds = await allocateItemRowIds(tx, data.lines.length);

      await tx.commonPurchaseOrder.create({
        data: {
          poOrderNo,
          poDate: now,
          validTill,
          orderStatusCd: 0, // Draft — matches largest ERP cohort
          supCode: data.supCode,
          remarks: (data.remarks ?? "Created via Tools Management").slice(0, 300),
          contactName: data.contactName?.slice(0, 50) ?? null,
          creatUserIdCd: creatUser,
          creatDt: now,
          poGoodsType: goodsType.slice(0, 50),
          poCat: goodsType.slice(0, 50),
          purchaseType: (data.purchaseType ?? "ONE TIME").slice(0, 20),
          currency: (data.currency ?? "INR").slice(0, 15),
          vendorType: "Supplier",
          purchaseValue: subTot,
          subTotValue: subTot,
        },
      });

      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i]!;
        const tool = toolMap.get(line.toolOrGaugeNo)!;
        const rate = lineRates[i]!;
        const comments =
          (line.comments?.trim() ||
            [tool.toolOrGaugeNo, tool.name].filter(Boolean).join(" — ") ||
            "").slice(0, 4000);

        await tx.commonPurchaseItem.create({
          data: {
            rowId: rowIds[i]!,
            poOrderNo,
            itemCode: tool.toolOrGaugeNo!.slice(0, 25),
            price: rate,
            qty: line.qty,
            uom: (line.uom || "Nos").slice(0, 10),
            comments,
            creatUserIdCd: creatUser,
            creatDt: now,
            itemType: "po",
            itemName: (tool.name ?? "").slice(0, 4000) || null,
            itemDesc: (tool.description ?? tool.name ?? "").slice(0, 4000) || null,
            toolRefNo: tool.refNo,
            remarks: "",
            hsnCode: "-Select-",
          },
        });
      }

      // Tools-owned finance row — payment starts UNPAID; line GL/budget optional
      await tx.toolsPoFinance.create({
        data: {
          poOrderNo,
          paymentStatus: "UNPAID",
          paymentDate: null,
          remarks: null,
          creatUserIdCd: creatUser,
          creatDt: now,
        },
      });
      if (hasLineFinance) {
        for (let i = 0; i < data.lines.length; i++) {
          const line = data.lines[i]!;
          const exp = line.expLedgerCode?.trim() || null;
          const bud = line.budgetCode?.trim() || null;
          if (!exp && !bud) continue;
          await tx.toolsPoFinanceLine.create({
            data: {
              poOrderNo,
              poItemRowId: rowIds[i]!,
              expLedgerCode: exp?.slice(0, 25) ?? null,
              budgetCode: bud?.slice(0, 50) ?? null,
              creatUserIdCd: creatUser,
              creatDt: now,
            },
          });
        }
      }

      return tx.commonPurchaseOrder.findUnique({
        where: { poOrderNo },
        include: {
          supplier: { select: { supCode: true, supName: true } },
          lines: {
            orderBy: { rowId: "asc" },
            include: {
              tool: { select: { refNo: true, toolOrGaugeNo: true, name: true } },
            },
          },
        },
      });
    });

    const finance = created
      ? await prisma.toolsPoFinance.findUnique({
          where: { poOrderNo: created.poOrderNo },
          include: { lines: true },
        })
      : null;
    const finByItem = new Map(
      (finance?.lines ?? []).map((fl) => [fl.poItemRowId, fl])
    );

    return NextResponse.json(
      {
        ok: true,
        po: created
          ? {
              poOrderNo: created.poOrderNo,
              poDate: created.poDate,
              orderStatusCd: created.orderStatusCd,
              statusLabel: statusLabel(created.orderStatusCd),
              supCode: created.supCode,
              supplier: created.supplier,
              purchaseValue:
                created.purchaseValue != null ? Number(created.purchaseValue) : subTot,
              paymentStatus: finance?.paymentStatus ?? "UNPAID",
              lines: (created.lines ?? []).map((l) => {
                const fl = finByItem.get(l.rowId);
                return {
                  rowId: l.rowId,
                  itemCode: l.itemCode,
                  qty: l.qty != null ? Number(l.qty) : null,
                  price: l.price != null ? Number(l.price) : null,
                  toolRefNo: l.toolRefNo,
                  tool: l.tool,
                  expLedgerCode: fl?.expLedgerCode ?? null,
                  budgetCode: fl?.budgetCode ?? null,
                };
              }),
            }
          : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/po:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create PO" },
      { status: 500 }
    );
  }
}
