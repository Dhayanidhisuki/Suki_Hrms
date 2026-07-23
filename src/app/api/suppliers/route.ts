import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { SupplierCreateSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  const where = {
    AND: [
      search
        ? {
            OR: [
              { supCode: { contains: search } },
              { supName: { contains: search } },
            ],
          }
        : {},
      status ? { status } : {},
    ],
  };

  const items = await prisma.supplier.findMany({
    where,
    orderBy: { creatDt: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = SupplierCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      creatUserIdCd: authCheck.session.userId,
    },
  });

  return NextResponse.json({ ok: true, supplier }, { status: 201 });
}
