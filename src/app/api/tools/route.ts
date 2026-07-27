import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { GaugeAndToolsCreateSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const grouping = searchParams.get("grouping") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 20));
  const skip = (page - 1) * pageSize;

  const where = {
    AND: [
      search
        ? {
            OR: [
              { toolOrGaugeNo: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : {},
      grouping ? { grouping: { contains: grouping } } : {},
      status ? { status } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.gaugeAndTools.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { creatDt: "desc" },
      include: { serialNumbers: true },
    }),
    prisma.gaugeAndTools.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = GaugeAndToolsCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { specifications, ...toolData } = parsed.data;

  const tool = await prisma.$transaction(async (tx) => {
    const created = await tx.gaugeAndTools.create({
      data: {
        ...toolData,
        qtyOut: 0,
        qtyNew: 0,
        creatUserIdCd: authCheck.session.userId,
        lstUpdtUserIdCd: authCheck.session.userId,
      },
    });

    if (created.serialNoGenReq === "Yes" && created.totQty && Number(created.totQty) > 0) {
      const serials = Array.from({ length: Number(created.totQty) }, (_, i) => ({
        refNo: created.refNo,
        toolOrGaugeNo: created.toolOrGaugeNo,
        serialNo: i + 1,
        status: "Available",
      }));
      await tx.gaugeSerialNo.createMany({ data: serials });
    }

    if (specifications && specifications.length > 0) {
      await tx.toolsSpecification.createMany({
        data: specifications.map((s) => ({
          toolRefNo: created.refNo,
          parameter: s.parameter,
          specification: s.specification,
        })),
      });
    }

    if (created.toolOrGaugeNo) {
      await tx.gaugeControlCard.create({
        data: { toolOrGaugeNo: created.toolOrGaugeNo, type: "Gauge", creatDt: new Date() },
      });
    }

    return created;
  });

  return NextResponse.json({ ok: true, tool }, { status: 201 });
}
