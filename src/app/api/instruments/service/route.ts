import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

const ServiceSchema = z.object({
  id: z.number().int().positive().optional(),
  defectId: z.number().int().positive().optional(),
  toolOrGaugeNo: z.string().trim().min(1).max(25),
  serviceAgency: z.string().trim().max(100).optional(),
  serviceDcNo: z.string().trim().max(30).optional(),
  sentDate: z.string().date().optional().or(z.literal("")),
  expectedReturnDate: z.string().date().optional().or(z.literal("")),
  receivedDate: z.string().date().optional().or(z.literal("")),
  repairDetails: z.string().trim().max(1000).optional(),
  cost: z.number().min(0).optional(),
  verificationResult: z.string().trim().max(500).optional(),
  status: z.string().trim().min(1).max(40),
  finalStatus: z.string().trim().max(40).optional(),
});

async function access() {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check;
  const permission = await requirePermission(check.session, "canManageCalibration");
  if (!permission.ok) return permission;
  return { ok: true as const, session: check.session };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const defectId = Number(req.nextUrl.searchParams.get("defectId") ?? 0);
  const toolOrGaugeNo = (req.nextUrl.searchParams.get("toolOrGaugeNo") ?? "").trim();
  const items = await prisma.instrumentServiceRecord.findMany({
    where: {
      ...(defectId > 0 ? { defectId } : {}),
      ...(toolOrGaugeNo ? { toolOrGaugeNo } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await access();
  if (!auth.ok) return auth.response;
  const parsed = ServiceSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const tool = await prisma.gaugeAndTools.findUnique({ where: { toolOrGaugeNo: parsed.data.toolOrGaugeNo } });
  if (!tool) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  const { id: _id, sentDate, expectedReturnDate, receivedDate, ...data } = parsed.data;
  void _id;
  const item = await prisma.instrumentServiceRecord.create({ data: {
    ...data, refNo: tool.refNo,
    sentDate: sentDate ? new Date(sentDate) : null,
    expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
    receivedDate: receivedDate ? new Date(receivedDate) : null,
    createdBy: auth.session.userId.slice(0, 50),
  } });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await access();
  if (!auth.ok) return auth.response;
  const parsed = ServiceSchema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "Valid service record is required" }, { status: 400 });
  const { id, sentDate, expectedReturnDate, receivedDate, toolOrGaugeNo: _toolNo, ...data } = parsed.data;
  void _toolNo;
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.instrumentServiceRecord.update({ where: { id }, data: {
      ...data,
      sentDate: sentDate ? new Date(sentDate) : null,
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      receivedDate: receivedDate ? new Date(receivedDate) : null,
      updatedBy: auth.session.userId.slice(0, 50),
    } });
    if (updated.defectId) await tx.instrumentDefect.update({ where: { id: updated.defectId }, data: { status: updated.finalStatus || updated.status, updatedBy: auth.session.userId.slice(0, 50) } });
    if (["Returned to Use", "Completed"].includes(updated.finalStatus ?? "")) {
      await tx.gaugeAndTools.update({ where: { refNo: updated.refNo }, data: { status: "Available" } });
      await tx.gaugeSerialNo.updateMany({ where: { OR: [{ toolRefNo: updated.refNo }, { toolOrGaugeNo: updated.toolOrGaugeNo }] }, data: { status: "AVAILABLE FOR USE" } });
    }
    return updated;
  });
  return NextResponse.json({ item });
}
