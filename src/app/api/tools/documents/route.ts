import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { isToolDocType } from "@/lib/toolDocumentTypes";
import {
  assertAllowedFile,
  dcDocumentKey,
  persistToolDocumentFile,
  removeDocFile,
  resolveStoredMime,
} from "@/lib/toolDocuments";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { searchParams } = req.nextUrl;
  const toolOrGaugeNo = (searchParams.get("toolOrGaugeNo") ?? "").trim();
  const dcNo = (searchParams.get("dcNo") ?? "").trim();
  const docType = (searchParams.get("docType") ?? "").trim();
  const categoryGroup = (searchParams.get("categoryGroup") ?? "").trim();
  const search = (searchParams.get("search") ?? "").trim();
  const fromDt = (searchParams.get("fromDt") ?? "").trim();
  const toDt = (searchParams.get("toDt") ?? "").trim();
  const calibRowIdRaw = searchParams.get("calibRowId");
  const calibRowId = calibRowIdRaw ? Number(calibRowIdRaw) : null;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? "30") || 30));
  const includeStats = searchParams.get("includeStats") === "1" || searchParams.get("includeStats") === "true";

  try {
    if (!prisma.toolDocument) {
      return NextResponse.json(
        {
          error:
            "Document API not ready — restart the Next.js server after prisma generate (ToolDocument model missing).",
        },
        { status: 503 }
      );
    }

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    if (toolOrGaugeNo) {
      where.toolOrGaugeNo = toolOrGaugeNo;
    }
    if (dcNo) {
      where.dcNo = dcNo.slice(0, 20);
    }
    if (calibRowId && Number.isFinite(calibRowId)) {
      where.calibRowId = calibRowId;
    }

    if (docType && isToolDocType(docType)) {
      where.docType = docType;
    } else if (categoryGroup && categoryGroup !== "ALL") {
      if (categoryGroup === "CERTIFICATES") {
        where.docType = { in: ["CALIB_CERTIFICATE", "CALIB_REPORT"] };
      } else if (categoryGroup === "PHOTOS") {
        where.docType = { in: ["TOOL_PHOTO", "CALIB_PHOTO", "DEFECT_PHOTO"] };
      } else if (categoryGroup === "TECHNICAL") {
        where.docType = { in: ["TOOL_MANUAL", "DRAWING"] };
      } else if (categoryGroup === "LOGISTICS") {
        where.docType = { in: ["DC_ATTACHMENT"] };
      } else if (categoryGroup === "OTHER") {
        where.docType = "OTHER";
      }
    }

    if (fromDt || toDt) {
      where.creatDt = {};
      if (fromDt) {
        where.creatDt.gte = new Date(`${fromDt}T00:00:00.000Z`);
      }
      if (toDt) {
        where.creatDt.lte = new Date(`${toDt}T23:59:59.999Z`);
      }
    }

    if (search) {
      where.OR = [
        { originalName: { contains: search } },
        { toolOrGaugeNo: { contains: search } },
        { dcNo: { contains: search } },
        { remarks: { contains: search } },
        { creatUserIdCd: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.toolDocument.findMany({
        where,
        orderBy: { creatDt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.toolDocument.count({ where }),
    ]);

    let stats = null;
    if (includeStats) {
      const [
        totalDocs,
        totalCerts,
        totalPhotos,
        totalManuals,
      ] = await Promise.all([
        prisma.toolDocument.count({ where: { deletedAt: null } }),
        prisma.toolDocument.count({
          where: {
            deletedAt: null,
            docType: { in: ["CALIB_CERTIFICATE", "CALIB_REPORT"] },
          },
        }),
        prisma.toolDocument.count({
          where: {
            deletedAt: null,
            docType: { in: ["TOOL_PHOTO", "CALIB_PHOTO", "DEFECT_PHOTO"] },
          },
        }),
        prisma.toolDocument.count({
          where: {
            deletedAt: null,
            docType: { in: ["TOOL_MANUAL", "DRAWING"] },
          },
        }),
      ]);

      stats = {
        totalDocs,
        totalCerts,
        totalPhotos,
        totalManuals,
      };
    }

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    });
  } catch (err) {
    console.error("GET /api/tools/documents failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  // Upload allowed for calib engineers or master editors / admin
  const calib = await requirePermission(authCheck.session, "canManageCalibration");
  const master = await requirePermission(authCheck.session, "canEditMaster");
  if (!calib.ok && !master.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    let toolOrGaugeNo = String(form.get("toolOrGaugeNo") ?? "").trim();
    const docTypeRaw = String(form.get("docType") ?? "OTHER").trim();
    const remarks = String(form.get("remarks") ?? "").trim() || null;
    const dcNo = String(form.get("dcNo") ?? "").trim() || null;
    const calibRowIdRaw = form.get("calibRowId");
    const calibRowId =
      calibRowIdRaw != null && String(calibRowIdRaw).trim() !== ""
        ? Number(calibRowIdRaw)
        : null;

    if (!toolOrGaugeNo && dcNo) {
      toolOrGaugeNo = dcDocumentKey(dcNo);
    }
    if (!toolOrGaugeNo) {
      return NextResponse.json(
        { error: "toolOrGaugeNo or dcNo is required" },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!isToolDocType(docTypeRaw)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = resolveStoredMime(file.name, file.type || "application/octet-stream");
    assertAllowedFile(file.name, mimeType, buffer.length);

    const tool = toolOrGaugeNo.startsWith("CALIB-DC-")
      ? null
      : await prisma.gaugeAndTools.findFirst({
          where: { toolOrGaugeNo },
          select: { refNo: true, toolOrGaugeNo: true },
        });

    const { storedName } = await persistToolDocumentFile({
      toolOrGaugeNo,
      originalName: file.name,
      mimeType,
      buffer,
    });

    try {
      const doc = await prisma.toolDocument.create({
        data: {
          toolOrGaugeNo,
          toolRefNo: tool?.refNo ?? null,
          docType: docTypeRaw,
          originalName: file.name.slice(0, 255),
          storedName,
          mimeType,
          sizeBytes: buffer.length,
          calibRowId: calibRowId && Number.isFinite(calibRowId) ? calibRowId : null,
          dcNo: dcNo?.slice(0, 20) ?? null,
          remarks: remarks?.slice(0, 200) ?? null,
          creatUserIdCd: authCheck.session.userId.slice(0, 50),
          creatDt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, item: doc }, { status: 201 });
    } catch (err) {
      await removeDocFile(toolOrGaugeNo, storedName);
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
