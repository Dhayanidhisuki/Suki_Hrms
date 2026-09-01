import { NextRequest, NextResponse } from "next/server";
import { checkModulePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { SubcontractorCreateSchema } from "@/lib/validators";
import {
  mapSubcontractorRow,
  toErpSubStatus,
  ynFromBody,
} from "@/lib/subcontractorMap";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const statusFilter = searchParams.get("status") ?? "";
  const approved = searchParams.get("approved") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const skip = (page - 1) * pageSize;

  const erpStatus = statusFilter ? toErpSubStatus(statusFilter) : null;

  try {
    const where = {
      AND: [
        search
          ? {
              OR: [
                { subConId: { contains: search } },
                { subName: { contains: search } },
                { natureOfWork: { contains: search } },
                { gstin: { contains: search } },
                { add1: { contains: search } },
                { add2: { contains: search } },
              ],
            }
          : {},
        erpStatus ? { status: erpStatus } : {},
        approved === "Yes"
          ? {
              OR: [
                { approvedSubcontractor: "Yes" },
                { approvedSubcontractor: "Y" },
              ],
            }
          : approved === "No"
            ? {
                OR: [
                  { approvedSubcontractor: null },
                  { approvedSubcontractor: "" },
                  { approvedSubcontractor: "No" },
                  { approvedSubcontractor: "N" },
                ],
              }
            : {},
      ],
    };

    const [raw, total] = await Promise.all([
      prisma.subcontractor.findMany({
        where,
        orderBy: { creatDt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.subcontractor.count({ where }),
    ]);

    return NextResponse.json({
      items: raw.map(mapSubcontractorRow),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error fetching subcontractors:", error);
    return NextResponse.json(
      { items: [], total: 0, error: "Failed to load subcontractors" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const permCheck = await checkModulePermission(authCheck.session, "subcontractor_master", "EDIT");
  if (!permCheck.allowed) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const subConId =
    (body.subConId as string) || (body.subCode as string) || "";
  const normalized = {
    subConId,
    subName: body.subName,
    natureOfWork: body.natureOfWork,
    isStoreVendor: ynFromBody(body.isStoreVendor),
    isInhouse: ynFromBody(body.isInhouse),
    isIssueDc: ynFromBody(body.isIssueDC ?? body.isIssueDc),
    add1: body.add1 ?? body.address,
    add2: body.add2,
    gstin: body.gstin,
    approvedSubcontractor:
      body.approvedSubcontractor ??
      (body.isApproved === true ? "Yes" : body.isApproved === false ? "No" : undefined),
    status: toErpSubStatus(body.status) ?? "ACTIVE",
  };

  const parsed = SubcontractorCreateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.subConId) {
    return NextResponse.json({ error: "subCode is required" }, { status: 400 });
  }

  try {
    const subcontractor = await prisma.subcontractor.create({
      data: {
        ...parsed.data,
        creatUserIdCd: authCheck.session.userId.slice(0, 10),
        creatDt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, item: mapSubcontractorRow(subcontractor) }, { status: 201 });
  } catch (error) {
    console.error("Error creating subcontractor:", error);
    return NextResponse.json({ error: "Failed to create subcontractor" }, { status: 500 });
  }
}
