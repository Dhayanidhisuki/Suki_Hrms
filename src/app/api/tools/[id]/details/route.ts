import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveUnitScope, unitIsAllowed } from "@/lib/unitScope";
import { z } from "zod";

const ToolsDetailsSchema = z.object({
  noOfCavity: z.number().int().min(0).optional(),
  runningCavity: z.number().int().min(0).optional(),
  toolLife: z.number().int().min(0).optional(),
  balanceToolLife: z.number().int().min(0).optional(),
  hardness: z.string().max(25).optional(),
  shrinkage: z.string().max(25).optional(),
  drawingNo: z.string().max(30).optional(),
});

/**
 * GET /api/tools/[id]/details
 * Returns ToolsDetails record for a given tool refNo.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo: toolRefNo } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  const unitScope = await resolveUnitScope(check.session);
  if (!unitIsAllowed(unitScope, tool.locationName)) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const details = await prisma.toolsDetails.findFirst({
    where: { toolRefNo },
  });

  return NextResponse.json({ details });
}

/**
 * PUT /api/tools/[id]/details
 * Upsert ToolsDetails for a given tool refNo.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;
  const permission = await requirePermission(check.session, "canEditMaster");
  if (!permission.ok) return permission.response;

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo: toolRefNo } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  const unitScope = await resolveUnitScope(check.session);
  if (!unitIsAllowed(unitScope, tool.locationName)) {
    return NextResponse.json({ error: "You do not have access to this instrument unit" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ToolsDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.toolsDetails.findFirst({ where: { toolRefNo } });

  let details;
  if (existing) {
    details = await prisma.toolsDetails.update({
      where: { rowId: existing.rowId },
      data: { ...parsed.data, creatDt: existing.creatDt },
    });
  } else {
    details = await prisma.toolsDetails.create({
      data: { toolRefNo, ...parsed.data, creatDt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, details });
}
