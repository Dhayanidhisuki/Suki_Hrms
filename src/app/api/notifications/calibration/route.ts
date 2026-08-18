import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requirePermission, requireSession } from "@/lib/auth";
import { generateCalibrationNotifications, systemRecipientKey } from "@/lib/calibrationNotifications";

function userKey(userDbId: number | null) {
  return userDbId ? systemRecipientKey(userDbId) : null;
}

export async function GET() {
  const check = await requireSession(await getSession()); if (!check.ok) return check.response;
  const recipientEmail = userKey(check.session.userDbId);
  if (!recipientEmail) return NextResponse.json({ items: [], unread: 0 });
  await generateCalibrationNotifications(check.session.userDbId!);
  const items = await prisma.calibrationNotification.findMany({ where: { channel: "SYSTEM", recipientEmail }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ items, unread: items.filter((item) => !item.readAt).length });
}

export async function POST() {
  const check = await requireSession(await getSession()); if (!check.ok) return check.response;
  const permission = await requirePermission(check.session, "canManageCalibration"); if (!permission.ok) return permission.response;
  if (!check.session.userDbId) return NextResponse.json({ error: "Authenticated user is not linked" }, { status: 400 });
  return NextResponse.json(await generateCalibrationNotifications(check.session.userDbId));
}

export async function PATCH(req: NextRequest) {
  const check = await requireSession(await getSession()); if (!check.ok) return check.response;
  const body = await req.json().catch(() => ({})) as { id?: number; all?: boolean };
  const recipientEmail = userKey(check.session.userDbId);
  if (!recipientEmail) return NextResponse.json({ error: "Authenticated user is not linked" }, { status: 400 });
  const now = new Date();
  if (body.all) await prisma.calibrationNotification.updateMany({ where: { channel: "SYSTEM", recipientEmail, readAt: null }, data: { readAt: now, status: "READ" } });
  else if (body.id) {
    const updated = await prisma.calibrationNotification.updateMany({ where: { id: body.id, channel: "SYSTEM", recipientEmail }, data: { readAt: now, status: "READ" } });
    if (!updated.count) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  else return NextResponse.json({ error: "Notification id or all is required" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
