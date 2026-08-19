import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import {
  findDueCalibrationTools,
  findNotificationUsers,
  toolVisibleToUser,
} from "@/lib/calibrationDueEmail";
import {
  buildCalibrationDigestPdf,
  buildCalibrationDigestXlsx,
} from "@/lib/calibrationDigestExport";
import {
  verifyCalibrationDigestToken,
  type DigestExportFormat,
} from "@/lib/calibrationPdfLink";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Whole-list calibration export for a digest recipient.
 *
 * Auth: either a signed digest token from the email, or an active session
 * (in which case `userId` selects whose scoped list to export, defaulting to
 * the session user).
 */
export async function GET(req: NextRequest) {
  const format = (
    (req.nextUrl.searchParams.get("format") ?? "pdf").trim().toLowerCase()
  ) as DigestExportFormat;
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json(
      { error: "format must be pdf or xlsx" },
      { status: 400 },
    );
  }

  const token = (req.nextUrl.searchParams.get("token") ?? "").trim();
  const claims = token ? verifyCalibrationDigestToken(token) : null;

  let userId = claims?.userId ?? null;

  if (!claims) {
    const session = await getSession();
    const check = await requireSession(session);
    if (!check.ok) return check.response;

    const raw = (req.nextUrl.searchParams.get("userId") ?? "").trim();
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) {
        return NextResponse.json({ error: "userId must be an integer" }, { status: 400 });
      }
      userId = parsed;
    } else {
      // session.userId holds the username, not the numeric id.
      const me = await prisma.user.findFirst({
        where: { username: check.session.userId, deletedAt: null },
        select: { id: true },
      });
      if (!me) {
        return NextResponse.json({ error: "Signed-in user not found" }, { status: 404 });
      }
      userId = me.id;
    }
  }

  try {
    const setting = await prisma.calibrationNotificationSetting.findUnique({
      where: { id: 1 },
    });
    const alertDays = Math.max(setting?.alertDays ?? 15, 15);

    const users = await findNotificationUsers();
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) {
      return NextResponse.json(
        { error: "Recipient is no longer eligible for calibration notifications" },
        { status: 404 },
      );
    }

    const now = new Date();
    const allDue = await findDueCalibrationTools(alertDays, now);
    const items = allDue.filter((item) => toolVisibleToUser(item, user));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No calibration records are currently due for this recipient" },
        { status: 404 },
      );
    }

    let companyName: string | null = null;
    try {
      const companies = await prisma.$queryRawUnsafe<
        Array<{ COMPANY_NAME?: string; DISP_COMPANY_NAME?: string }>
      >(
        `SELECT TOP 1 COMPANY_NAME, DISP_COMPANY_NAME FROM COMPANY_DETAILS ORDER BY COMPANY_NAME`,
      );
      companyName =
        companies[0]?.DISP_COMPANY_NAME?.trim() ||
        companies[0]?.COMPANY_NAME?.trim() ||
        null;
    } catch {
      // optional
    }

    const meta = {
      recipientName: user.name,
      roleName: user.roleName,
      companyName,
      generatedAt: now,
    };

    const stamp = now.toISOString().slice(0, 10);
    const buffer =
      format === "pdf"
        ? buildCalibrationDigestPdf(items, meta)
        : buildCalibrationDigestXlsx(items, meta);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : XLSX_MIME,
        "Content-Disposition": `attachment; filename="Calibration_Due_List_${stamp}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/tools/calibration-due/digest failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate calibration export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
