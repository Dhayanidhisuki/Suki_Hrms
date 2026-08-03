import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { PoScheduleCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.toolsPoSchMaster.findMany({
    orderBy: { creatDt: "desc" },
    include: { lines: true },
  });

  // Collect all unique poTransNo values used as tool refNos
  const allPoTransNos = [...new Set(items.flatMap((m) => m.lines.map((l) => l.poTransNo)))];

  // Batch-lookup tools by refNo
  const tools = await prisma.gaugeAndTools.findMany({
    where: { refNo: { in: allPoTransNos } },
    select: { refNo: true, toolOrGaugeNo: true, name: true },
  });
  const toolMap = new Map(tools.map((t) => [t.refNo, t]));

  // Enrich each schedule line with toolOrGaugeNo + tool name
  const enriched = items.map((item) => ({
    ...item,
    lines: item.lines.map((line) => {
      const tool = toolMap.get(line.poTransNo) ?? null;
      return {
        ...line,
        toolOrGaugeNo: tool?.toolOrGaugeNo ?? String(line.poTransNo),
        tool: tool ? { name: tool.name ?? "" } : null,
      };
    }),
  }));

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canRaisePO");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = PoScheduleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { poOrderNo, lines } = parsed.data;

  try {
    // Resolve toolOrGaugeNo → tool refNo for each line
    const toolNos = lines.map((l) => l.toolOrGaugeNo);
    const tools = await prisma.gaugeAndTools.findMany({
      where: { toolOrGaugeNo: { in: toolNos } },
      select: { refNo: true, toolOrGaugeNo: true },
    });
    const toolRefMap = new Map(tools.map((t) => [t.toolOrGaugeNo, t.refNo]));

    const schedule = await prisma.$transaction(async (tx) => {
      const master = await tx.toolsPoSchMaster.create({
        data: {
          poOrderNo,
          schDate: new Date(),
          creatDt: new Date(),
          creatUserIdCd: authCheck.session.userId,
        },
      });

      let fallbackIdx = 1;
      for (const l of lines) {
        const refNo = toolRefMap.get(l.toolOrGaugeNo) ?? fallbackIdx++;
        await tx.toolsPoSchTrans.create({
          data: {
            refNo: master.rowId,
            poTransNo: refNo,
            qty: l.qty,
            creatDt: new Date(),
            creatUserIdCd: authCheck.session.userId,
          },
        });
      }

      return tx.toolsPoSchMaster.findUnique({
        where: { rowId: master.rowId },
        include: { lines: true },
      });
    });

    return NextResponse.json({ ok: true, schedule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
