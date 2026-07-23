import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { PoScheduleCreateSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const schedule = await prisma.toolsPoSchMaster.findUnique({
    where: { id: Number(id) },
    include: { lines: true, supplier: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json({ schedule });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canRaisePO");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const body = await req.json();
  const parsed = PoScheduleCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const schedule = await prisma.toolsPoSchMaster.update({
    where: { id: Number(id) },
    data: {
      poRef: parsed.data.poRef,
      supCode: parsed.data.supCode,
    },
  });

  return NextResponse.json({ ok: true, schedule });
}
