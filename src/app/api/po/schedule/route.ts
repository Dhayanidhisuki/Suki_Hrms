import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { generateDocNumber } from "@/lib/autonumber";
import { PoScheduleCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.toolsPoSchMaster.findMany({
    orderBy: { createdDate: "desc" },
    include: { lines: true, supplier: true },
  });
  return NextResponse.json({ items });
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

  const { poRef, supCode, lines } = parsed.data;

  const scheduleNo = await generateDocNumber("SCH", "TOOLS_PO_SCH_MASTER", "SCHEDULE_NO");

  const schedule = await prisma.toolsPoSchMaster.create({
    data: {
      scheduleNo,
      poRef,
      supCode,
      overallStatus: "Pending",
      creatUserIdCd: authCheck.session.userId,
      lines: {
        create: lines.map((l) => ({
          toolOrGaugeNo: l.toolOrGaugeNo,
          expectedDate: new Date(l.expectedDate),
          expectedQty: l.expectedQty,
          receivedQty: 0,
          status: "Pending",
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json({ ok: true, schedule }, { status: 201 });
}
