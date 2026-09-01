import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { checkModulePermission } from "@/lib/rbac";

async function access(manage = false) {
  const check = await requireSession(await getSession());
  if (!check.ok) return check;
  if (manage) {
    const permission = await checkModulePermission(check.session, "settings_roles", "EDIT");
    if (!permission.allowed) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, session: check.session };
}

export async function GET() {
  const auth = await access(); if (!auth.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const [setting, recipients, users] = await Promise.all([
    prisma.calibrationNotificationSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.calibrationNotificationRecipient.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        isActive: true,
        userRole: {
          select: {
            role: {
              select: {
                roleName: true,
                isSystemAdmin: true,
                rolePermissions: {
                  where: { action: "RECEIVE_EMAIL", module: { moduleKey: "email_notifications" } },
                  select: { allowed: true },
                },
              },
            },
          },
        },
        unitScopes: { select: { unitScope: true } },
      },
    }),
  ]);
  const primaryRecipients = users.map((user) => {
    const role = user.userRole?.role;
    const permissionEnabled = Boolean(role?.isSystemAdmin || role?.rolePermissions.some((permission) => permission.allowed));
    const eligible = user.isActive && Boolean(user.email) && permissionEnabled && Boolean(role);
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: role?.roleName ?? null,
      unitScopes: user.unitScopes.map((scope) => scope.unitScope),
      isActive: user.isActive,
      permissionEnabled,
      eligible,
      reason: !user.isActive
        ? "User inactive"
        : !user.email
          ? "Email missing"
          : !role
            ? "Role not assigned"
            : !permissionEnabled
              ? "Receive Alerts disabled"
              : "Ready",
    };
  });
  return NextResponse.json({ setting, recipients, primaryRecipients });
}

const SettingsSchema = z.object({ alertDays: z.number().int().min(1).max(365), emailEnabled: z.boolean(), systemEnabled: z.boolean() });
export async function PUT(req: NextRequest) {
  const auth = await access(true); if (!auth.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const parsed = SettingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const setting = await prisma.calibrationNotificationSetting.upsert({ where: { id: 1 }, update: { ...parsed.data, updatedBy: auth.session!.userId.slice(0, 50) }, create: { id: 1, ...parsed.data, updatedBy: auth.session!.userId.slice(0, 50) } });
  return NextResponse.json({ setting });
}

const RecipientSchema = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(150), unitCode: z.string().trim().max(100).optional().or(z.literal("")), isActive: z.boolean().default(true) });
export async function POST(req: NextRequest) {
  const auth = await access(true); if (!auth.ok) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const parsed = RecipientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, unitCode, ...data } = parsed.data;
  const values = { ...data, unitCode: unitCode || null, updatedBy: auth.session!.userId.slice(0, 50) };
  const recipient = id
    ? await prisma.calibrationNotificationRecipient.update({ where: { id }, data: values })
    : await prisma.calibrationNotificationRecipient.create({ data: { ...values, createdBy: auth.session!.userId.slice(0, 50) } });
  return NextResponse.json({ recipient }, { status: id ? 200 : 201 });
}
