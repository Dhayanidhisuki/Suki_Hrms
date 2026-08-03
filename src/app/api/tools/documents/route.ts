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
  const calibRowIdRaw = searchParams.get("calibRowId");
  const calibRowId = calibRowIdRaw ? Number(calibRowIdRaw) : null;

  if (!toolOrGaugeNo && !dcNo) {
    return NextResponse.json(
      { error: "toolOrGaugeNo or dcNo is required" },
      { status: 400 }
    );
  }

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

    const items = await prisma.toolDocument.findMany({
      where: {
        deletedAt: null,
        ...(toolOrGaugeNo ? { toolOrGaugeNo } : {}),
        ...(dcNo ? { dcNo: dcNo.slice(0, 20) } : {}),
        ...(calibRowId && Number.isFinite(calibRowId) ? { calibRowId } : {}),
      },
      orderBy: { creatDt: "desc" },
      take: 100,
    });

    return NextResponse.json({ items });
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
