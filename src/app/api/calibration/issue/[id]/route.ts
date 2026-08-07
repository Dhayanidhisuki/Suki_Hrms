import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession, requirePermission } from "@/lib/auth";
import { resolveErpAuditUserId } from "@/lib/erpActor";
import { CalibIssueUpdateSchema } from "@/lib/validators";

function isCalibIssueLineOpen(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return (
    !s ||
    s === "ISSUED" ||
    s === "OPEN" ||
    s === "UNDER CALIBRATION" ||
    s.includes("ISSUE FOR CALIBRATION") ||
    s === "PENDING"
  );
}

function isCalibIssueLineReceived(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase();
  return s === "RECEIVED" || s === "CLOSED" || s.includes("RECEIVED");
}

function deriveHeaderStatus(item: {
  receiveHeaders?: { recNo: number }[];
  inHouseLines?: { resultStatus: string | null; status: string | null }[];
}): "OPEN" | "PARTIAL" | "CLOSED" {
  const lines = item.inHouseLines ?? [];
  if (lines.length === 0) {
    return (item.receiveHeaders?.length ?? 0) > 0 ? "CLOSED" : "OPEN";
  }
  const openCount = lines.filter((l) => isCalibIssueLineOpen(l.status)).length;
  const receivedCount = lines.filter((l) => isCalibIssueLineReceived(l.status)).length;
  const done = lines.filter((l) => String(l.resultStatus ?? "").trim()).length;
  if (openCount === 0 || (done > 0 && done === lines.length)) return "CLOSED";
  if ((receivedCount > 0 && openCount > 0) || (done > 0 && done < lines.length)) return "PARTIAL";
  return "OPEN";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const check = await requireSession(session);
  if (!check.ok) return check.response;

  const { id } = await params;
  const issue = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo: Number(id) },
    include: {
      inHouseLines: { include: { tool: true } },
      receiveHeaders: { include: { lines: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
  }

  const status = deriveHeaderStatus(issue);
  return NextResponse.json({ issue: { ...issue, status } });
}

/**
 * PUT /api/calibration/issue/[id]
 * Edit open/partial calib DC header fields.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const authCheck = await requireSession(session);
  if (!authCheck.ok) return authCheck.response;

  const permCheck = await requirePermission(authCheck.session, "canManageCalibration");
  if (!permCheck.ok) return permCheck.response;

  const { id } = await params;
  const dcNo = Number(id);
  if (!Number.isFinite(dcNo)) {
    return NextResponse.json({ error: "Invalid DC No" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = CalibIssueUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.toolsIssueForCalibration.findUnique({
    where: { dcNo },
    include: {
      inHouseLines: { select: { status: true, resultStatus: true } },
      receiveHeaders: { select: { recNo: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Calibration issue not found" }, { status: 404 });
  }

  const status = deriveHeaderStatus(existing);
  if (status === "CLOSED") {
    return NextResponse.json(
      { error: `DC ${dcNo} is closed and cannot be edited` },
      { status: 400 }
    );
  }

  try {
    const erpActor = await resolveErpAuditUserId(authCheck.session);
    const data = parsed.data;
    const issue = await prisma.toolsIssueForCalibration.update({
      where: { dcNo },
      data: {
        ...(data.receiveName !== undefined ? { receiveName: data.receiveName } : {}),
        ...(data.subCode !== undefined ? { subCode: data.subCode } : {}),
        ...(data.issueDate !== undefined ? { issueDate: new Date(data.issueDate) } : {}),
        ...(data.issueFor !== undefined ? { issueFor: data.issueFor } : {}),
        ...(data.toolsPoNo !== undefined ? { toolsPoNo: data.toolsPoNo } : {}),
        lstUpdtUserIdCd: erpActor,
      },
    });
    return NextResponse.json({ ok: true, issue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
