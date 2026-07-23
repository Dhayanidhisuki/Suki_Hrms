import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SupplierUpdateSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
    include: { toolsMappings: true },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ supplier });
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
  const body = await req.json();
  const parsed = SupplierUpdateSchema.safeParse({ ...body, id: Number(id) });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id: _id, ...data } = parsed.data;
  const supplier = await prisma.supplier.update({
    where: { id: Number(id) },
    data: { ...data, lstUpdtUserId: authCheck.session.userId },
  });

  return NextResponse.json({ ok: true, supplier });
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
  const orphanCount = await prisma.toolsMapping.count({
    where: { supCode: { equals: undefined } },
  });

  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
    include: { toolsMappings: true },
  });

  if (supplier && supplier.toolsMappings.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete supplier with existing tool mappings" },
      { status: 400 }
    );
  }

  await prisma.supplier.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canApproveSupplier");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const updated = await prisma.supplier.update({
    where: { id: Number(id) },
    data: {
      isApproved: !supplier.isApproved,
      lstUpdtUserId: authCheck.session.userId,
    },
  });

  return NextResponse.json({ ok: true, supplier: updated });
}
