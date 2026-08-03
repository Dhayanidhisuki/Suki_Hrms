import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { z } from "zod";

const ToolsMappingCreateSchema = z.object({
  supCode: z.string().min(1).max(10),
});

/**
 * GET /api/tools/[id]/suppliers
 * Returns all approved supplier mappings (ToolsMapping) for a tool.
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

  const mappings = await prisma.toolsMapping.findMany({
    where: { toolRefNo },
    orderBy: { creatDt: "asc" },
  });

  // Enrich with supplier names
  const supCodes = mappings.map((m) => m.supCode).filter(Boolean) as string[];
  const suppliers = await prisma.supplier.findMany({
    where: { supCode: { in: supCodes } },
    select: { supCode: true, supName: true, approvedSupplier: true },
  });
  const supMap = new Map(suppliers.map((s) => [s.supCode, s]));

  const items = mappings.map((m) => ({
    ...m,
    supplier: m.supCode ? (supMap.get(m.supCode) ?? null) : null,
  }));

  return NextResponse.json({ items });
}

/**
 * POST /api/tools/[id]/suppliers
 * Add an approved supplier mapping for a tool.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageTools");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo: toolRefNo } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const body = await req.json();
  const parsed = ToolsMappingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Prevent duplicate mappings
  const existing = await prisma.toolsMapping.findFirst({
    where: { toolRefNo, supCode: parsed.data.supCode },
  });
  if (existing) {
    return NextResponse.json({ error: "Supplier already mapped to this tool" }, { status: 409 });
  }

  const mapping = await prisma.toolsMapping.create({
    data: {
      toolRefNo,
      supCode: parsed.data.supCode,
      creatDt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, mapping }, { status: 201 });
}

/**
 * DELETE /api/tools/[id]/suppliers
 * Remove an approved supplier mapping. Expects { supCode } in body.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageTools");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const body = await req.json();
  const { supCode } = body as { supCode?: string };
  if (!supCode) return NextResponse.json({ error: "supCode is required" }, { status: 400 });

  const existing = await prisma.toolsMapping.findFirst({ where: { toolRefNo, supCode } });
  if (!existing) return NextResponse.json({ error: "Mapping not found" }, { status: 404 });

  await prisma.toolsMapping.delete({ where: { rowId: existing.rowId } });

  return NextResponse.json({ ok: true });
}
