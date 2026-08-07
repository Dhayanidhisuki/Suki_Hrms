import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SubcontractorUpdateSchema } from "@/lib/validators";
import {
  mapSubcontractorRow,
  toErpSubStatus,
  ynFromBody,
} from "@/lib/subcontractorMap";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const subcontractor = await prisma.subcontractor.findUnique({
    where: { subConId: id },
  });

  if (!subcontractor) {
    return NextResponse.json({ error: "Subcontractor not found" }, { status: 404 });
  }

  return NextResponse.json({ item: mapSubcontractorRow(subcontractor) });
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
  const normalized = {
    subConId: id,
    subName: body.subName,
    natureOfWork: body.natureOfWork,
    isStoreVendor:
      body.isStoreVendor !== undefined ? ynFromBody(body.isStoreVendor) : undefined,
    isInhouse: body.isInhouse !== undefined ? ynFromBody(body.isInhouse) : undefined,
    isIssueDc:
      body.isIssueDC !== undefined || body.isIssueDc !== undefined
        ? ynFromBody(body.isIssueDC ?? body.isIssueDc)
        : undefined,
    add1: body.add1 ?? body.address,
    add2: body.add2,
    gstin: body.gstin,
    approvedSubcontractor:
      body.approvedSubcontractor ??
      (body.isApproved === true ? "Yes" : body.isApproved === false ? "No" : undefined),
    status: body.status !== undefined ? toErpSubStatus(body.status) : undefined,
  };

  const parsed = SubcontractorUpdateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { subConId: _id, ...data } = parsed.data;

  try {
    const subcontractor = await prisma.subcontractor.update({
      where: { subConId: id },
      data: {
        ...data,
        lstUpdtUserIdCd: authCheck.session.userId.slice(0, 10),
      },
    });

    return NextResponse.json({ ok: true, item: mapSubcontractorRow(subcontractor) });
  } catch (error) {
    console.error("Error updating subcontractor:", error);
    return NextResponse.json({ error: "Failed to update subcontractor" }, { status: 500 });
  }
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
  await prisma.subcontractor.delete({ where: { subConId: id } });
  return NextResponse.json({ ok: true });
}
