import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";

function yesNo(v: string | null | undefined): boolean {
  return String(v ?? "").trim().toUpperCase() === "YES" || String(v ?? "").trim().toUpperCase() === "Y";
}

function mapStatus(v: string | null | undefined): "Active" | "Inactive" {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "ACTIVE" || s === "A" ? "Active" : "Inactive";
}

function mapItem(item: {
  subConId: string;
  subName: string | null;
  natureOfWork: string | null;
  gstin: string | null;
  add1: string | null;
  add2: string | null;
  isStoreVendor: string | null;
  isInhouse: string | null;
  isIssueDc: string | null;
  status: string | null;
  creatUserIdCd: string | null;
  creatDt: Date | null;
}) {
  return {
    id: item.subConId,
    subCode: item.subConId,
    subName: item.subName ?? "",
    natureOfWork: item.natureOfWork ?? "",
    gstin: item.gstin,
    address: [item.add1, item.add2].filter(Boolean).join(", ") || null,
    isStoreVendor: yesNo(item.isStoreVendor),
    isInhouse: yesNo(item.isInhouse),
    isIssueDC: yesNo(item.isIssueDc),
    status: mapStatus(item.status),
    creatUserIdCd: item.creatUserIdCd ?? "",
    creatDt: item.creatDt,
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
  const subcontractor = await prisma.subcontractor.findUnique({
    where: { subConId: id },
  });

  if (!subcontractor) {
    return NextResponse.json({ error: "Subcontractor not found" }, { status: 404 });
  }

  return NextResponse.json({ item: mapItem(subcontractor) });
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

  try {
    const subcontractor = await prisma.subcontractor.update({
      where: { subConId: id },
      data: {
        subName: body.subName,
        natureOfWork: body.natureOfWork,
        gstin: body.gstin,
        add1: body.address ?? body.add1,
        isStoreVendor: body.isStoreVendor === true || body.isStoreVendor === "Yes" ? "Yes" : "No",
        isInhouse: body.isInhouse === true || body.isInhouse === "Yes" ? "Yes" : "No",
        isIssueDc: body.isIssueDC === true || body.isIssueDc === true || body.isIssueDC === "Yes" ? "Yes" : "No",
        status: body.status === "Inactive" ? "BLOCKED" : body.status === "Active" ? "ACTIVE" : body.status,
        lstUpdtUserIdCd: authCheck.session.userId,
      },
    });

    return NextResponse.json({ ok: true, item: mapItem(subcontractor) });
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
