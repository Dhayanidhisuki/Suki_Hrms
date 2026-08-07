import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { z } from "zod";

const CreateSchema = z.object({
  toolRefNo: z.number().int().positive().optional(),
  toolOrGaugeNo: z.string().min(1).max(25).optional(),
  /** Stored in TOOLS_MAPPING.SUP_CODE for both suppliers and subcontractors (ERP schema). */
  supCode: z.string().min(1).max(50),
  vendorType: z.enum(["Supplier", "SubContractor"]).optional().default("Supplier"),
}).refine((d) => d.toolRefNo != null || (d.toolOrGaugeNo && d.toolOrGaugeNo.length > 0), {
  message: "toolRefNo or toolOrGaugeNo is required",
});

/**
 * GET /api/tools-mapping
 * Paginated TOOLS_MAPPING list (tool ↔ vendor). SUP_CODE holds supplier or subcontractor id.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const vendorCode = (searchParams.get("vendorCode") ?? searchParams.get("supCode") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
  const skip = (page - 1) * pageSize;

  const where = {
    AND: [
      vendorCode ? { supCode: vendorCode } : {},
      search
        ? {
            OR: [
              { supCode: { contains: search } },
              { tool: { toolOrGaugeNo: { contains: search } } },
              { tool: { name: { contains: search } } },
              { tool: { description: { contains: search } } },
              { tool: { grouping: { contains: search } } },
            ],
          }
        : {},
    ],
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.toolsMapping.findMany({
        where,
        orderBy: { creatDt: "desc" },
        skip,
        take: pageSize,
        include: {
          tool: {
            select: {
              refNo: true,
              toolOrGaugeNo: true,
              name: true,
              description: true,
              grouping: true,
              type: true,
              status: true,
            },
          },
        },
      }),
      prisma.toolsMapping.count({ where }),
    ]);

    const codes = Array.from(
      new Set(rows.map((r) => r.supCode).filter((c): c is string => Boolean(c)))
    );
    const [suppliers, subcontractors] = await Promise.all([
      prisma.supplier.findMany({
        where: { supCode: { in: codes } },
        select: {
          supCode: true,
          supName: true,
          city: true,
          gstin: true,
          status: true,
          approvedSupplier: true,
          phone1: true,
        },
      }),
      prisma.subcontractor.findMany({
        where: { subConId: { in: codes } },
        select: {
          subConId: true,
          subName: true,
          gstin: true,
          status: true,
        },
      }),
    ]);
    const supMap = new Map(suppliers.map((s) => [s.supCode, s]));
    const subMap = new Map(subcontractors.map((s) => [s.subConId, s]));

    const items = rows.map((r) => {
      const supplier = r.supCode ? (supMap.get(r.supCode) ?? null) : null;
      const sub = !supplier && r.supCode ? (subMap.get(r.supCode) ?? null) : null;
      const vendorType = supplier ? "Supplier" : sub ? "SubContractor" : "Unknown";
      return {
        rowId: r.rowId,
        toolRefNo: r.toolRefNo,
        toolOrGaugeNo: r.tool?.toolOrGaugeNo ?? null,
        toolName: r.tool?.name ?? r.tool?.description ?? null,
        grouping: r.tool?.grouping ?? null,
        type: r.tool?.type ?? null,
        toolStatus: r.tool?.status ?? null,
        vendorType,
        supCode: r.supCode,
        supplierName: supplier?.supName ?? sub?.subName ?? null,
        city: supplier?.city ?? null,
        gstin: supplier?.gstin ?? sub?.gstin ?? null,
        supplierStatus: supplier?.status ?? sub?.status ?? null,
        approvedSupplier: supplier?.approvedSupplier ?? null,
        phone: supplier?.phone1 ?? null,
        creatDt: r.creatDt,
      };
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    console.error("TOOLS_MAPPING list failed:", err);
    return NextResponse.json(
      { items: [], total: 0, error: "Failed to load tool mappings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools-mapping
 * Create a tool ↔ vendor mapping row (SUP_CODE = supplier or subcontractor id).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canEditMaster");
  if (!permCheck.ok) return permCheck.response;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supCode, toolRefNo: rawRef, toolOrGaugeNo, vendorType } = parsed.data;

  const tool = rawRef
    ? await prisma.gaugeAndTools.findUnique({ where: { refNo: rawRef } })
    : await prisma.gaugeAndTools.findUnique({
        where: { toolOrGaugeNo: toolOrGaugeNo as string },
      });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  if (vendorType === "SubContractor") {
    const sub = await prisma.subcontractor.findUnique({ where: { subConId: supCode } });
    if (!sub) {
      return NextResponse.json({ error: `Subcontractor ${supCode} not found` }, { status: 404 });
    }
  } else {
    const supplier = await prisma.supplier.findUnique({ where: { supCode } });
    if (!supplier) {
      return NextResponse.json({ error: `Supplier ${supCode} not found` }, { status: 404 });
    }
  }

  const existing = await prisma.toolsMapping.findFirst({
    where: { toolRefNo: tool.refNo, supCode },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This tool is already mapped to that vendor" },
      { status: 409 }
    );
  }

  const mapping = await prisma.toolsMapping.create({
    data: {
      toolRefNo: tool.refNo,
      supCode,
      creatDt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, mapping }, { status: 201 });
}
