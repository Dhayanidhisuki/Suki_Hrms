import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { ConsumptionCreateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const items = await prisma.toolsConsumptionTransIssue.findMany({
    orderBy: { creatDt: "desc" },
    include: { tool: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canLogConsumption");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = ConsumptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.toolsConsumptionTransIssue.create({
    data: {
      ...parsed.data,
      consumptionDate: new Date(parsed.data.consumptionDate),
      verifiedBy: parsed.data.verifiedBySupervisor ? authCheck.session.userId : null,
      creatUserIdCd: authCheck.session.userId,
    },
  });

  return NextResponse.json({ ok: true, record }, { status: 201 });
}
