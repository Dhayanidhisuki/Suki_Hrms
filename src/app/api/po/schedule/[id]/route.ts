import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { PoScheduleCreateSchema } from "@/lib/validators";
import { checkModulePermission } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const schedule = await prisma.toolsPoSchMaster.findUnique({
    where: { rowId: Number(id) },
    include: { lines: true },
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
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "purchase", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = PoScheduleCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const schedule = await prisma.toolsPoSchMaster.update({
    where: { rowId: Number(id) },
    data: {
      poOrderNo: parsed.data.poOrderNo,
    },
  });

  return NextResponse.json({ ok: true, schedule });
}
