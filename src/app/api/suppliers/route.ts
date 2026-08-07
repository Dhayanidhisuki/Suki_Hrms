import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SupplierCreateSchema } from "@/lib/validators";
import { mapSupplierRow, normalizeSupplierBody, toErpSupplierStatus } from "@/lib/supplierMap";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const status = searchParams.get("status") ?? "";
  const approved = searchParams.get("approved") ?? ""; // Yes | No | ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const skip = (page - 1) * pageSize;

  const erpStatus = status ? toErpSupplierStatus(status) : null;

  const where = {
    AND: [
      search
        ? {
            OR: [
              { supCode: { contains: search } },
              { supName: { contains: search } },
              { city: { contains: search } },
              { gstin: { contains: search } },
              { bankName: { contains: search } },
              { accountNumber: { contains: search } },
              { ifscCode: { contains: search } },
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
    items: rows.map(mapSupplierRow),
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
  const normalized = normalizeSupplierBody(body as Record<string, unknown>);
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

  return NextResponse.json({ ok: true, supplier: mapSupplierRow(supplier) }, { status: 201 });
}
