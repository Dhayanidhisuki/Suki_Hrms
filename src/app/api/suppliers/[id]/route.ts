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
    where: { supCode: id },
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
  const parsed = SupplierUpdateSchema.safeParse({ ...body, supCode: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supCode: _supCode, ...data } = parsed.data;
  const supplier = await prisma.supplier.update({
    where: { supCode: id },
    data: { ...data, lstUpdtUserIdCd: authCheck.session.userId },
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
  await prisma.supplier.delete({ where: { supCode: id } });
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
    where: { supCode: id },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const currentApproved = supplier.approvedSupplier === "Yes";
  const updated = await prisma.supplier.update({
    where: { supCode: id },
    data: {
      approvedSupplier: currentApproved ? "No" : "Yes",
      lstUpdtUserIdCd: authCheck.session.userId,
    },
  });

  return NextResponse.json({ ok: true, supplier: updated });
}
