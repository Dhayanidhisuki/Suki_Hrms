import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { GaugeAndToolsCreateSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const refNo = Number(id);
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { refNo },
    include: {
      serialNumbers: true,
      specifications: true,
      priceMaster: { orderBy: { revDate: "desc" } },
      details: true,
      machineMapping: true,
      toolsMapping: true,
      calibControlCard: { include: { history: { orderBy: { cDate: "desc" } } } },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  return NextResponse.json({ tool });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const refNo = Number(id);
  const body = await req.json();
  const parsed = GaugeAndToolsCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { specifications, ...updateData } = parsed.data;

  const tool = await prisma.gaugeAndTools.update({
    where: { refNo },
    data: { ...updateData, lstUpdtUserIdCd: authCheck.session.userId },
  });

  return NextResponse.json({ ok: true, tool });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canDeleteMaster");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  await prisma.gaugeAndTools.delete({ where: { refNo: Number(id) } });
  return NextResponse.json({ ok: true });
}
