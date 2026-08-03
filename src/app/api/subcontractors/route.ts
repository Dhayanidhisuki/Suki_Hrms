import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SubcontractorCreateSchema } from "@/lib/validators";

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
    rawStatus: item.status,
    creatUserIdCd: item.creatUserIdCd ?? "",
    creatDt: item.creatDt,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  try {
    const where = {
      AND: [
        search
          ? {
              OR: [
                { subConId: { contains: search } },
                { subName: { contains: search } },
              ],
            }
          : {},
        statusFilter === "Active"
          ? { status: { equals: "ACTIVE" } }
          : statusFilter === "Inactive"
            ? { NOT: { status: { equals: "ACTIVE" } } }
            : {},
      ],
    };

    const raw = await prisma.subcontractor.findMany({
      where,
      orderBy: { creatDt: "desc" },
      take: 500,
    });

    return NextResponse.json({ items: raw.map(mapItem), total: raw.length });
  } catch (error) {
    console.error("Error fetching subcontractors:", error);
    return NextResponse.json({ items: [], error: "Failed to load subcontractors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = SubcontractorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const subConId = (data as { subConId?: string; subCode?: string }).subConId
    ?? (body.subCode as string)
    ?? (body.subConId as string);

  if (!subConId) {
    return NextResponse.json({ error: "subCode is required" }, { status: 400 });
  }

  try {
    const subcontractor = await prisma.subcontractor.create({
      data: {
        subConId,
        subName: body.subName ?? data.subName,
        natureOfWork: body.natureOfWork,
        gstin: body.gstin,
        add1: body.address ?? body.add1,
        isStoreVendor: body.isStoreVendor === true || body.isStoreVendor === "Yes" ? "Yes" : "No",
        isInhouse: body.isInhouse === true || body.isInhouse === "Yes" ? "Yes" : "No",
        isIssueDc: body.isIssueDC === true || body.isIssueDc === true || body.isIssueDC === "Yes" ? "Yes" : "No",
        status: body.status === "Inactive" ? "BLOCKED" : "ACTIVE",
        creatUserIdCd: authCheck.session.userId,
        creatDt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, item: mapItem(subcontractor) }, { status: 201 });
  } catch (error) {
    console.error("Error creating subcontractor:", error);
    return NextResponse.json({ error: "Failed to create subcontractor" }, { status: 500 });
  }
}
