import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { PoReceiveCreateSchema } from "@/lib/validators";
import {
  allocateGrnTransRowIds,
  allocateNextGirNo,
} from "@/lib/poNumbering";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") || 50)));
  const search = (sp.get("search") || "").trim();
  const status = (sp.get("status") || "").trim();
  const fromDate = (sp.get("fromDate") || "").trim();
  const toDate = (sp.get("toDate") || "").trim();
  const supCode = (sp.get("supCode") || "").trim();

  const where: {
    OR?: Array<Record<string, unknown>>;
    girStatus?: string;
    supCode?: string;
    girDate?: { gte?: Date; lte?: Date };
  } = {};

  if (search) {
    const asNum = Number(search);
    where.OR = [
      ...(Number.isFinite(asNum) && search === String(asNum)
        ? [{ girNo: asNum }]
        : []),
      { girNoNew: { contains: search } },
      { poOrderNo: { contains: search } },
      { supCode: { contains: search } },
      { supplier: { is: { supName: { contains: search } } } },
      // Tool no on GRN lines (e.g. OTH_J00289)
      { lines: { some: { itemCode: { contains: search } } } },
      {
        lines: {
          some: { tool: { is: { toolOrGaugeNo: { contains: search } } } },
        },
      },
    ];
  }
  if (status && status !== "ALL") where.girStatus = status;
  if (supCode && supCode !== "ALL") where.supCode = supCode;
  if (fromDate || toDate) {
    where.girDate = {};
    if (fromDate) where.girDate.gte = new Date(`${fromDate}T00:00:00`);
    if (toDate) where.girDate.lte = new Date(`${toDate}T23:59:59`);
  }

  try {
    const [total, items] = await Promise.all([
      prisma.toolsPoReceive.count({ where }),
      prisma.toolsPoReceive.findMany({
        where,
        orderBy: [{ girNo: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: true,
          lines: {
            include: {
              tool: { select: { toolOrGaugeNo: true, name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error("GET /api/po/grn:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load GRNs", items: [], total: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canRaisePO");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = PoReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { poOrderNo, supCode, girDate, lines } = parsed.data;

  let creatUser: string;
  try {
    creatUser = (await resolveErpAuditUserId(authCheck.session)).slice(0, 10);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No valid ERP user for CREAT_USER_ID_CD — set erpUserCode on your Tools user",
      },
      { status: 400 }
    );
  }

  const girDt = new Date(girDate);
  const now = new Date();

  const toolNos = lines.map((l) => l.itemCode);
  const tools = await prisma.gaugeAndTools.findMany({
    where: { toolOrGaugeNo: { in: toolNos } },
    select: { toolOrGaugeNo: true, refNo: true },
  });
  const toolMap = new Map(tools.map((t) => [t.toolOrGaugeNo, t]));
  for (const line of lines) {
    if (!toolMap.has(line.itemCode)) {
      return NextResponse.json(
        { error: `Tool not found in Asset Master: ${line.itemCode}` },
        { status: 400 }
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { girNo, girNoNew } = await allocateNextGirNo(tx);
      const rowIds = await allocateGrnTransRowIds(tx, lines.length);

      // Match live ERP: most Tools GRNs use OPEN (not Posted)
      const grn = await tx.toolsPoReceive.create({
        data: {
          girNo,
          girNoNew,
          poOrderNo: poOrderNo.slice(0, 16),
          supCode: supCode.slice(0, 10),
          girDate: girDt,
          girStatus: "OPEN",
          creatUserIdCd: creatUser,
          creatDt: now,
        },
      });

      await tx.$executeRawUnsafe(
        `UPDATE dbo.TOOLS_PO_RECEIVE
         SET FINANCE_POSTING_STATUS = N'PENDING', POST_AMT = 0
         WHERE GIR_NO = ${girNo}`
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const tool = toolMap.get(line.itemCode)!;

        await tx.toolsPoReceiveTrans.create({
          data: {
            rowId: rowIds[i]!,
            girNo,
            itemCode: line.itemCode.slice(0, 25),
            itemType: "po",
            qtyOrder: line.invQty,
            invQty: line.invQty,
            recQty: line.recQty,
            price: line.price,
            toolRefNo: tool.refNo,
            creatDt: now,
          },
        });

        await tx.gaugeAndTools.update({
          where: { toolOrGaugeNo: line.itemCode },
          data: {
            qtyNew: { increment: line.recQty },
            totQty: { increment: line.recQty },
            qtyIn: { increment: line.recQty },
            lstUpdtUserIdCd: creatUser,
          },
        });
      }

      return { grn, pricedLines: lines.map((l) => ({ ...l, refNo: toolMap.get(l.itemCode)!.refNo })) };
    });

    // Pricing outside GRN transaction — must not roll back stock if pricing fails
    for (const line of result.pricedLines) {
      try {
        await prisma.toolsPriceMaster.create({
          data: {
            toolRefNo: line.refNo,
            revDate: girDt,
            supCode: supCode.slice(0, 10),
            rate: line.price,
            creatUserIdCd: creatUser,
            creatDt: now,
            approvalStatus: "APPROVED",
          },
        });
      } catch (priceErr) {
        console.warn("GRN price master write skipped:", priceErr);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        grn: {
          girNo: result.grn.girNo,
          girNoNew: result.grn.girNoNew,
          poOrderNo: result.grn.poOrderNo,
          girStatus: result.grn.girStatus,
          girDate: result.grn.girDate,
          supCode: result.grn.supCode,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/po/grn:", err);
    const raw = err instanceof Error ? err.message : "Transaction failed";
    let message = raw;
    if (raw.includes("FK_TOOLS_PO_RECEIVE_ERP_USER") || raw.includes("ERP_USER")) {
      message =
        "ERP user FK failed on CREAT_USER_ID_CD. Set Settings → Users → ERP User Code to a real ERP USER_ID (e.g. GANESH).";
    } else if (raw.includes("GIR_NO") && raw.includes("Null")) {
      message = "GIR_NO allocation failed — restart the Next.js server after prisma generate.";
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
