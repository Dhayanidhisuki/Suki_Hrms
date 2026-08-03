import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SupplierUpdateSchema } from "@/lib/validators";

function mapSupplier(s: {
  supCode: string;
  supName: string | null;
  add1: string | null;
  city: string | null;
  state: string | null;
  phone1: string | null;
  emailId: string | null;
  gstin: string | null;
  approvedSupplier: string | null;
  status: string | null;
  creatUserIdCd: string;
  creatDt: Date | null;
}) {
  const approved =
    (s.approvedSupplier ?? "").toUpperCase() === "YES" ||
    (s.approvedSupplier ?? "").toUpperCase() === "Y";
  const rawStatus = (s.status ?? "").toUpperCase();
  const uiStatus =
    rawStatus === "BLOCKED" || rawStatus === "INACTIVE" ? "Inactive" : "Active";

  return {
    id: s.supCode,
    supCode: s.supCode,
    supName: s.supName ?? "",
    address: s.add1,
    city: s.city,
    state: s.state,
    phone: s.phone1,
    email: s.emailId,
    gstin: s.gstin,
    status: uiStatus as "Active" | "Inactive",
    isApproved: approved,
    creatUserIdCd: s.creatUserIdCd,
    creatDt: s.creatDt,
  };
}

function normalizeBody(body: Record<string, unknown>, id: string) {
  return {
    supCode: id,
    supName: body.supName,
    add1: body.add1 ?? body.address,
    city: body.city,
    state: body.state,
    gstin: body.gstin,
    phone1: body.phone1 ?? body.phone,
    emailId: body.emailId ?? body.email ?? "",
    bankName: body.bankName,
    accountNumber: body.accountNumber,
    ifscCode: body.ifscCode,
    approvedSupplier: body.approvedSupplier
      ?? (body.isApproved === true ? "Yes" : body.isApproved === false ? "No" : undefined),
    status:
      body.status === "Inactive" || body.status === "BLOCKED"
        ? "BLOCKED"
        : body.status === "Active"
          ? "ACTIVE"
          : body.status,
  };
}

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

  return NextResponse.json({ supplier: mapSupplier(supplier) });
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
  const parsed = SupplierUpdateSchema.safeParse(normalizeBody(body, id));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supCode: _supCode, ...data } = parsed.data;
  const supplier = await prisma.supplier.update({
    where: { supCode: id },
    data: { ...data, lstUpdtUserIdCd: authCheck.session.userId.slice(0, 10) },
  });

  return NextResponse.json({ ok: true, supplier: mapSupplier(supplier) });
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

  return NextResponse.json({ ok: true, supplier: mapSupplier(updated) });
}
