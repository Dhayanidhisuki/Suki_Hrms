import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SupplierCreateSchema } from "@/lib/validators";

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
    rawStatus === "BLOCKED" || rawStatus === "INACTIVE" ? "Inactive" : rawStatus ? "Active" : "Active";

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
    erpStatus: s.status,
    isApproved: approved,
    creatUserIdCd: s.creatUserIdCd,
    creatDt: s.creatDt,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const status = searchParams.get("status") ?? "";
  const approved = searchParams.get("approved") ?? ""; // Yes | No | ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const skip = (page - 1) * pageSize;

  // ERP stores status as "ACTIVE"/"BLOCKED"; map app UI values to ERP equivalents
  const statusMap: Record<string, string> = {
    Active: "ACTIVE",
    Inactive: "BLOCKED",
    active: "ACTIVE",
    inactive: "BLOCKED",
  };
  const erpStatus = status ? (statusMap[status] ?? status) : null;

  const where = {
    AND: [
      search
        ? {
            OR: [
              { supCode: { contains: search } },
              { supName: { contains: search } },
              { city: { contains: search } },
              { gstin: { contains: search } },
            ],
          }
        : {},
      erpStatus ? { status: erpStatus } : {},
      approved === "Yes"
        ? { OR: [{ approvedSupplier: "Yes" }, { approvedSupplier: "Y" }] }
        : approved === "No"
          ? {
              OR: [
                { approvedSupplier: null },
                { approvedSupplier: "" },
                { approvedSupplier: "No" },
                { approvedSupplier: "N" },
              ],
            }
          : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { creatDt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.supplier.count({ where }),
  ]);

  return NextResponse.json({
    items: rows.map(mapSupplier),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();

  // Accept UI-friendly field names as well as ERP column names
  const normalized = {
    supCode: body.supCode,
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

  const parsed = SupplierCreateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      creatUserIdCd: authCheck.session.userId.slice(0, 10),
      creatDt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, supplier: mapSupplier(supplier) }, { status: 201 });
}
