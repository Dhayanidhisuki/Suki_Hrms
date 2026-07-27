import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { z } from "zod";

const SpecCreateSchema = z.object({
  specName: z.string().min(1),
  specValue: z.string().optional(),
  unit: z.string().optional(),
});

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
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const specs = await prisma.toolsSpecification.findMany({
    where: { toolRefNo: refNo },
    orderBy: { creatDt: "asc" },
  });

  return NextResponse.json({ specs });
}

export async function POST(
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
  const tool = await prisma.gaugeAndTools.findUnique({
    where: { refNo },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = SpecCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const spec = await prisma.toolsSpecification.create({
    data: {
      toolRefNo: refNo,
      parameter: parsed.data.specName,
      specification: parsed.data.specValue,
    },
  });

  return NextResponse.json({ ok: true, spec }, { status: 201 });
}
