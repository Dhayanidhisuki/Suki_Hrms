import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

const DefectSchema = z.object({
  toolOrGaugeNo: z.string().trim().min(1).max(25),
  unitCode: z.string().trim().max(100).optional(),
  reportedDate: z.string().date(),
  defectDetails: z.string().trim().min(1).max(1000),
  errorDeviation: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const status = (req.nextUrl.searchParams.get("status") ?? "").trim();
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const items = await prisma.instrumentDefect.findMany({
    where: {
      ...(status && status !== "ALL" ? { status } : {}),
      ...(search ? { OR: [
        { toolOrGaugeNo: { contains: search } },
        { defectDetails: { contains: search } },
        { unitCode: { contains: search } },
      ] } : {}),
    },
    include: { tool: { select: { description: true, grouping: true, type: true } }, serviceRecords: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { reportedDate: "desc" },
    take: 500,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const permission = await requirePermission(check.session, "canManageCalibration");
  if (!permission.ok) return permission.response;
  const parsed = DefectSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tool = await prisma.gaugeAndTools.findUnique({ where: { toolOrGaugeNo: parsed.data.toolOrGaugeNo } });
  if (!tool || !/(INSTRUMENT|TOOLS AND GAUGES)/i.test(tool.grouping)) {
    return NextResponse.json({ error: "Instrument or gauge not found in the managed catalog" }, { status: 404 });
  }
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.instrumentDefect.create({ data: {
      refNo: tool.refNo,
      toolOrGaugeNo: parsed.data.toolOrGaugeNo,
      unitCode: parsed.data.unitCode || null,
      reportedDate: new Date(parsed.data.reportedDate),
      defectDetails: parsed.data.defectDetails,
      errorDeviation: parsed.data.errorDeviation || null,
      reportedBy: check.session.userId.slice(0, 50),
    } });
    await tx.gaugeAndTools.update({ where: { refNo: tool.refNo }, data: { status: "Needs Attention" } });
    await tx.gaugeSerialNo.updateMany({ where: { OR: [{ toolRefNo: tool.refNo }, { toolOrGaugeNo: parsed.data.toolOrGaugeNo }] }, data: { status: "NEEDS ATTENTION" } });
    return created;
  });
  return NextResponse.json({ item }, { status: 201 });
}
