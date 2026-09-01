import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { z } from "zod";
import { checkModulePermission } from "@/lib/rbac";

const MachineMappingCreateSchema = z.object({
  macCode: z.string().min(1).max(25),
});

/**
 * GET /api/tools/[id]/machines
 * Returns all machine assignments (ToolsMachineTrans) for a tool.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo: toolRefNo } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const items = await prisma.toolsMachineTrans.findMany({
    where: { toolRefNo },
    orderBy: { creatDt: "asc" },
  });

  return NextResponse.json({ items });
}

/**
 * POST /api/tools/[id]/machines
 * Assign a machine to a tool.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tool_master", "CREATE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const tool = await prisma.gaugeAndTools.findUnique({ where: { refNo: toolRefNo } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const body = await req.json();
  const parsed = MachineMappingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Prevent duplicate assignments
  const existing = await prisma.toolsMachineTrans.findFirst({
    where: { toolRefNo, macCode: parsed.data.macCode },
  });
  if (existing) {
    return NextResponse.json({ error: "Machine already assigned to this tool" }, { status: 409 });
  }

  const assignment = await prisma.toolsMachineTrans.create({
    data: {
      toolRefNo,
      macCode: parsed.data.macCode,
      creatDt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, assignment }, { status: 201 });
}

/**
 * DELETE /api/tools/[id]/machines?macCode=XXX
 * Remove a machine assignment.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "tool_master", "DELETE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const toolRefNo = parseInt(id, 10);
  if (isNaN(toolRefNo)) return NextResponse.json({ error: "Invalid tool ID" }, { status: 400 });

  const macCode =
    req.nextUrl.searchParams.get("macCode")?.trim() ||
    ((await req.json().catch(() => ({}))) as { macCode?: string }).macCode?.trim();
  if (!macCode) return NextResponse.json({ error: "macCode is required" }, { status: 400 });

  const existing = await prisma.toolsMachineTrans.findFirst({ where: { toolRefNo, macCode } });
  if (!existing) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  await prisma.toolsMachineTrans.delete({ where: { rowId: existing.rowId } });

  return NextResponse.json({ ok: true });
}
