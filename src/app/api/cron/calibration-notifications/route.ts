import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewCalibrationDueEmails, runCalibrationDueEmails, runCalibrationTestEmail } from "@/lib/calibrationDueEmail";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/calibration-notifications
 * Called by an external cron scheduler. Requires Authorization: Bearer <CRON_SECRET>.
 *
 * Query params:
 *   ?preview=1       — read-only plan preview, no email sent
 *   ?testEmail=addr  — send one branded test email without consuming a real reminder
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const params = new URL(request.url).searchParams;
    const testEmailValue = params.get("testEmail");
    if (testEmailValue !== null) {
      const parsed = z.string().trim().email().safeParse(testEmailValue);
      if (!parsed.success) {
        return NextResponse.json({ error: "testEmail must be a valid email address" }, { status: 400 });
      }
      const result = await runCalibrationTestEmail(parsed.data);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }
    if (params.get("preview") === "1") {
      return NextResponse.json(await previewCalibrationDueEmails());
    }
    return NextResponse.json(await runCalibrationDueEmails());
  } catch (error) {
    console.error("Calibration notification cron failed:", error);
    return NextResponse.json({ error: "Calibration notification job failed" }, { status: 500 });
  }
}

/**
 * POST /api/cron/calibration-notifications
 * Admin-triggered force-resend. Requires a valid session with canManageSettings
 * permission — no CRON_SECRET needed from the browser.
 *
 * Skips the SENT deduplication guard so users who were added or had their email
 * address updated since the last scheduled run will receive their digest.
 *
 * Body (optional JSON):
 *   { testEmail?: string }  — when present, sends a test email instead of the full digest
 */
export async function POST(req: NextRequest) {
  const check = await requireSession(await getSession());
  if (!check.ok) return check.response;
  const permission = await requirePermission(check.session, "canManageSettings");
  if (!permission.ok) return permission.response;

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const testEmail = typeof body.testEmail === "string" ? body.testEmail.trim() : null;

    if (testEmail !== null) {
      const parsed = z.string().email().safeParse(testEmail);
      if (!parsed.success) {
        return NextResponse.json({ error: "testEmail must be a valid email address" }, { status: 400 });
      }
      const result = await runCalibrationTestEmail(parsed.data);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    // Force mode: ignore SENT status for current milestone window
    const result = await runCalibrationDueEmails(new Date(), { force: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Force-resend calibration notifications failed:", error);
    return NextResponse.json({ error: "Force-resend failed" }, { status: 500 });
  }
}
