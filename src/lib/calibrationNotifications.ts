import { prisma } from "@/lib/prisma";
import {
  findDueCalibrationTools,
  normalizeUnitScope,
  toolVisibleToUser,
  type NotificationUser,
  type UnitScope,
} from "@/lib/calibrationDueEmail";

async function notificationUser(userId: number): Promise<NotificationUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      deletedAt: null,
      userRole: { is: { role: { OR: [
        { isSystemAdmin: true },
        { rolePermissions: { some: {
          allowed: true,
          action: "RECEIVE_EMAIL",
          module: { moduleKey: "email_notifications" },
        } } },
      ] } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      userRole: { select: { role: { select: { roleName: true } } } },
      unitScopes: { select: { unitScope: true } },
    },
  });
  if (!user?.userRole) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email || user.username,
    roleName: user.userRole.role.roleName,
    unitScopes: user.unitScopes
      .map((scope) => normalizeUnitScope(scope.unitScope))
      .filter((scope): scope is UnitScope => scope !== null),
  };
}

export const systemRecipientKey = (userId: number) => `USER:${userId}`;

export async function generateCalibrationNotifications(userId: number, now = new Date()) {
  const setting = await prisma.calibrationNotificationSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, alertDays: 15, emailEnabled: true, systemEnabled: true },
  });
  if (!setting.systemEnabled) return { created: 0, dueCount: 0, alertDays: setting.alertDays };
  const user = await notificationUser(userId);
  if (!user) return { created: 0, dueCount: 0, alertDays: setting.alertDays };
  const due = (await findDueCalibrationTools(setting.alertDays, now))
    .filter((item) => toolVisibleToUser(item, user));
  const recipientEmail = systemRecipientKey(userId);
  let created = 0;
  for (const item of due) {
    const existing = await prisma.calibrationNotification.findFirst({ where: {
      toolOrGaugeNo: item.toolOrGaugeNo,
      unitCode: item.unitCode,
      dueDate: item.dueDate,
      channel: "SYSTEM",
      recipientEmail,
    } });
    if (existing) continue;
    const timing = item.daysRemaining < 0
      ? `${Math.abs(item.daysRemaining)} day(s) overdue`
      : item.daysRemaining === 0 ? "due today" : `due in ${item.daysRemaining} day(s)`;
    await prisma.calibrationNotification.create({ data: {
      toolOrGaugeNo: item.toolOrGaugeNo,
      unitCode: item.unitCode,
      dueDate: item.dueDate,
      channel: "SYSTEM",
      recipientEmail,
      responsibility: "Internal",
      subject: `Calibration ${timing}: ${item.toolOrGaugeNo}`,
      message: `${item.toolOrGaugeNo}${item.description ? ` — ${item.description}` : ""} is ${timing}.`,
      status: "UNREAD",
    } });
    created += 1;
  }
  return { created, dueCount: due.length, alertDays: setting.alertDays };
}
