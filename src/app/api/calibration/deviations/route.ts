import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

const Schema = z.object({
  resultId: z.number().int().positive().optional(), issueLineRowId: z.number().int().positive().optional(),
  toolOrGaugeNo: z.string().trim().min(1).max(25), parameter: z.string().trim().min(1).max(100),
  expectedValue: z.string().trim().max(100).optional(), observedValue: z.string().trim().max(100).optional(),
  deviation: z.string().trim().min(1).max(200), permissibleLimit: z.string().trim().max(100).optional(),
  resultStatus: z.enum(["Pass", "Fail", "Attention"]), correctiveAction: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession(); const check = await requireSession(session); if (!check.ok) return check.response;
  const permission = await requirePermission(check.session, "canManageCalibration"); if (!permission.ok) return permission.response;
  const parsed = Schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const item = await prisma.calibrationDeviation.create({ data: { ...parsed.data, recordedBy: check.session.userId.slice(0, 50) } });
  return NextResponse.json({ item }, { status: 201 });
}
