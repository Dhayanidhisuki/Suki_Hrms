import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { SupplierUpdateSchema } from "@/lib/validators";
import { mapSupplierRow, normalizeSupplierBody } from "@/lib/supplierMap";
import { checkModulePermission } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { supCode: id },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ supplier: mapSupplierRow(supplier) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "supplier_master", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = SupplierUpdateSchema.safeParse(
    normalizeSupplierBody(body as Record<string, unknown>, id)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supCode: _supCode, ...data } = parsed.data;
  const supplier = await prisma.supplier.update({
    where: { supCode: id },
    data: { ...data, lstUpdtUserIdCd: authCheck.session.userId.slice(0, 10) },
  });

  return NextResponse.json({ ok: true, supplier: mapSupplierRow(supplier) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "supplier_master", "DELETE");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

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
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "supplier_master", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { supCode: id },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const currentApproved =
    (supplier.approvedSupplier ?? "").toUpperCase() === "YES" ||
    (supplier.approvedSupplier ?? "").toUpperCase() === "Y";
  const updated = await prisma.supplier.update({
    where: { supCode: id },
    data: {
      approvedSupplier: currentApproved ? "No" : "Yes",
      lstUpdtUserIdCd: authCheck.session.userId.slice(0, 10),
    },
  });

  return NextResponse.json({ ok: true, supplier: mapSupplierRow(updated) });
}
