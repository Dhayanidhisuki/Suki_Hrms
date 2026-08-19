import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { digestTemplate, testEmailTemplate } from "@/lib/email/emailTemplates";
import type { Prisma } from "@prisma/client";

const DAY_MS = 86_400_000;
const INCLUDED_TOOL_STATUSES = ["Active", "Available"];
const ALL_UNIT_ROLES = new Set(["Tools Admin", "Quality Manager"]);

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// escapeHtml lives in emailTemplates.ts — not needed here

export type UnitScope = "UNIT1" | "UNIT2" | "UNIT3" | "COMMON";

export function normalizeUnitScope(value: string | null | undefined): UnitScope | null {
  const compact = value?.trim().toUpperCase().replace(/[\s_-]/g, "");
  if (compact === "UNIT1") return "UNIT1";
  if (compact === "UNIT2") return "UNIT2";
  if (compact === "UNIT3") return "UNIT3";
  if (compact === "COMMON") return "COMMON";
  return null;
}

const unitLabel = (value: string | null) => value?.replace(/^UNIT/, "Unit ") ?? "Unit not assigned";

export type DueCalibrationTool = {
  refNo: number;
  toolOrGaugeNo: string;
  name: string | null;
  description: string | null;
  size: string | null;
  usedLocation: string | null;
  unitCode: UnitScope | null;
  responsibility: string;
  dueDate: Date;
  daysRemaining: number;
  dueStatus: "OVERDUE" | "DUE_TODAY" | "DUE_SOON";
};

export type NotificationUser = {
  id: number;
  name: string;
  email: string;
  roleName: string;
  unitScopes: UnitScope[];
};

export async function findDueCalibrationTools(warningDays: number, now = new Date()) {
  if (!Number.isInteger(warningDays) || warningDays < 1 || warningDays > 365) {
    throw new Error("warningDays must be an integer between 1 and 365");
  }
  const today = startOfDay(now);
  const through = new Date(today);
  through.setDate(through.getDate() + warningDays);
  through.setHours(23, 59, 59, 999);
  const eligibleStatus: Prisma.GaugeAndToolsWhereInput = {
    OR: [{ status: null }, { status: { in: INCLUDED_TOOL_STATUSES } }],
  };
  const [unitRows, importedRows] = await Promise.all([
    prisma.toolsUnitStock.findMany({
      where: { nextCalibDate: { lte: through }, tool: eligibleStatus },
      select: {
        unitCode: true,
        nextCalibDate: true,
        tool: { select: { refNo: true, toolOrGaugeNo: true, name: true, description: true, size: true, location: true } },
      },
    }),
    prisma.instrumentImportedMasterData.findMany({
      where: { nextCalibrationDue: { lte: through }, tool: eligibleStatus },
      select: {
        nextCalibrationDue: true,
        tool: { select: { refNo: true, toolOrGaugeNo: true, name: true, description: true, size: true, location: true, locationName: true } },
      },
    }),
  ]);
  const rows = new Map<string, DueCalibrationTool>();
  const add = (
    tool: { refNo: number; toolOrGaugeNo: string | null; name: string | null; description: string | null; size: string | null; location: string | null },
    dueDate: Date | null,
    rawUnit: string | null,
  ) => {
    if (!dueDate || !tool.toolOrGaugeNo) return;
    const unitCode = normalizeUnitScope(rawUnit);
    const daysRemaining = Math.round((startOfDay(dueDate).getTime() - today.getTime()) / DAY_MS);
    rows.set(`${tool.refNo}:${unitCode ?? "UNKNOWN"}`, {
      refNo: tool.refNo,
      toolOrGaugeNo: tool.toolOrGaugeNo,
      name: tool.name,
      description: tool.description,
      size: tool.size,
      usedLocation: tool.location,
      unitCode,
      responsibility: "Internal",
      dueDate,
      daysRemaining,
      dueStatus: daysRemaining < 0 ? "OVERDUE" : daysRemaining === 0 ? "DUE_TODAY" : "DUE_SOON",
    });
  };
  for (const row of unitRows) add(row.tool, row.nextCalibDate, row.unitCode);
  const toolsWithUnitDates = new Set(unitRows.map((row) => row.tool.refNo));
  for (const row of importedRows) {
    if (!toolsWithUnitDates.has(row.tool.refNo)) add(row.tool, row.nextCalibrationDue, row.tool.locationName);
  }
  return [...rows.values()].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function findNotificationUsers(): Promise<NotificationUser[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      email: { not: null },
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
      userRole: { select: { role: { select: { roleName: true } } } },
      unitScopes: { select: { unitScope: true } },
    },
  });
  return users.flatMap((user) => user.email && user.userRole ? [{
    id: user.id,
    name: user.name,
    email: user.email,
    roleName: user.userRole.role.roleName,
    unitScopes: user.unitScopes
      .map((scope) => normalizeUnitScope(scope.unitScope))
      .filter((scope): scope is UnitScope => scope !== null),
  }] : []);
}

export function toolVisibleToUser(item: DueCalibrationTool, user: NotificationUser) {
  if (!item.unitCode) return user.roleName === "Quality Manager";
  if (ALL_UNIT_ROLES.has(user.roleName) || user.unitScopes.includes("COMMON")) return true;
  return user.unitScopes.includes(item.unitCode);
}

// Digest and test templates are imported from @/lib/email/emailTemplates.

function dailyDigestChannel(now: Date) {
  return `D${now.toISOString().slice(2, 10).replaceAll("-", "")}`;
}

async function buildDeliveryPlan(now = new Date()) {
  const setting = await prisma.calibrationNotificationSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, alertDays: 15, emailEnabled: true, systemEnabled: true },
  });
  const [allDue, users, escalationRecipients] = await Promise.all([
    findDueCalibrationTools(Math.max(setting.alertDays, 15), now),
    findNotificationUsers(),
    prisma.calibrationNotificationRecipient.findMany({ where: { isActive: true } }),
  ]);
  // Include the complete alert window in each morning digest. The dated
  // channel below deduplicates delivery per recipient for that calendar run.
  const milestones = allDue;
  const deliveries = users.flatMap((user) => {
    const items = milestones.filter((item) => toolVisibleToUser(item, user));
    if (!items.length) return [];
    const cc = user.roleName === "Quality Manager"
      ? escalationRecipients.filter((recipient) => {
          const scope = normalizeUnitScope(recipient.unitCode);
          return !scope || scope === "COMMON" || items.some((item) => item.unitCode === scope);
        }).map((recipient) => recipient.email)
      : [];
    return [{ user, items, cc: [...new Set(cc.map((email) => email.toLowerCase()))] }];
  });
  return { setting, allDue, milestones, users, escalationRecipients, deliveries };
}

export async function previewCalibrationDueEmails(now = new Date()) {
  const plan = await buildDeliveryPlan(now);
  return {
    preview: true,
    emailEnabled: plan.setting.emailEnabled,
    alertDays: plan.setting.alertDays,
    dueCount: plan.allDue.length,
    milestoneCount: plan.milestones.length,
    eligibleUserCount: plan.users.length,
    escalationRecipientCount: plan.escalationRecipients.length,
    deliveries: plan.deliveries.map(({ user, items, cc }) => ({
      recipient: user.email,
      role: user.roleName,
      unitScopes: user.unitScopes,
      itemCount: items.length,
      units: [...new Set(items.map((item) => unitLabel(item.unitCode)))],
      cc,
    })),
  };
}

export async function runCalibrationTestEmail(testEmail: string, now = new Date()) {
  const setting = await prisma.calibrationNotificationSetting.upsert({
    where: { id: 1 }, update: {}, create: { id: 1, alertDays: 15, emailEnabled: true, systemEnabled: true },
  });
  const [item] = await findDueCalibrationTools(Math.max(setting.alertDays, 15), now);
  if (!item) throw new Error("No due or overdue calibration record is available for the test email");
  const subject = `[TEST] Calibration ${item.dueStatus === "OVERDUE" ? "overdue" : "due"}: ${item.toolOrGaugeNo}`;
  const key = {
    toolOrGaugeNo: item.toolOrGaugeNo,
    unitCode: item.unitCode,
    dueDate: item.dueDate,
    channel: "TEST_EMAIL",
    recipientEmail: testEmail,
  };
  const existing = await prisma.calibrationNotification.findFirst({ where: key });
  const notification = existing
    ? await prisma.calibrationNotification.update({
        where: { id: existing.id },
        data: { status: "TEST_PENDING", errorMessage: null, sentAt: null, subject },
      })
    : await prisma.calibrationNotification.create({ data: {
        ...key,
        responsibility: "Internal",
        subject,
        message: `SMTP test using ${item.toolOrGaugeNo}; this does not suppress its real notification.`,
        status: "TEST_PENDING",
      } });
  try {
    const smtp = await sendEmail({
      notificationId: notification.id,
      to: testEmail,
      subject,
      html: testEmailTemplate(item),
    });
    await prisma.calibrationNotification.update({ where: { id: notification.id }, data: { status: "TEST_SENT" } });
    return { ok: true as const, recipient: testEmail, subject, tool: item, smtp };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.calibrationNotification.update({
      where: { id: notification.id },
      data: { status: "TEST_FAILED", errorMessage: message.slice(0, 500) },
    });
    return { ok: false as const, recipient: testEmail, subject, tool: item, error: message };
  }
}

export async function runCalibrationDueEmails(now = new Date(), options: { force?: boolean } = {}) {
  const { force = false } = options;
  const plan = await buildDeliveryPlan(now);
  if (!plan.setting.emailEnabled) {
    return { ...(await previewCalibrationDueEmails(now)), sent: 0, skipped: 0, failed: 0, forced: force, smtpResponses: [] };
  }
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const smtpResponses: Array<{ recipient: string; itemCount: number; response: string; messageId: string }> = [];
  for (const delivery of plan.deliveries) {
    const pending: Array<{ item: DueCalibrationTool; channel: string; id?: number }> = [];
    for (const item of delivery.items) {
      const channel = dailyDigestChannel(now);
      const existing = await prisma.calibrationNotification.findFirst({ where: {
        toolOrGaugeNo: item.toolOrGaugeNo,
        unitCode: item.unitCode,
        dueDate: item.dueDate,
        channel,
        recipientEmail: delivery.user.email,
      } });
      if (existing?.status === "SENT" && !force) {
        skipped += 1;
      } else {
        pending.push({ item, channel, id: existing?.id });
      }
    }
    if (!pending.length) continue;
    const subject = `Calibration digest: ${pending.length} reminder${pending.length === 1 ? "" : "s"}`;
    const logs = [];
    for (const entry of pending) {
      const data = {
        toolOrGaugeNo: entry.item.toolOrGaugeNo,
        unitCode: entry.item.unitCode,
        dueDate: entry.item.dueDate,
        channel: entry.channel,
        recipientEmail: delivery.user.email,
        responsibility: "Internal",
        subject,
        message: `${entry.item.toolOrGaugeNo} is included in a role/unit calibration digest.`,
        status: "PENDING",
        errorMessage: null,
      };
      logs.push(entry.id
        ? await prisma.calibrationNotification.update({ where: { id: entry.id }, data })
        : await prisma.calibrationNotification.create({ data }));
    }
    try {
      const smtp = await sendEmail({
        notificationId: logs[0].id,
        to: delivery.user.email,
        cc: delivery.cc,
        subject,
        html: digestTemplate(delivery.user, pending.map((entry) => entry.item)),
      }); // digestTemplate now uses branded HTML from emailTemplates.ts
      await prisma.calibrationNotification.updateMany({
        where: { id: { in: logs.map((log) => log.id) } },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null, ccAddress: delivery.cc.join(", ") || null },
      });
      sent += 1;
      smtpResponses.push({
        recipient: delivery.user.email,
        itemCount: pending.length,
        response: smtp.response,
        messageId: smtp.messageId,
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.calibrationNotification.updateMany({
        where: { id: { in: logs.map((log) => log.id) } },
        data: { status: "FAILED", errorMessage: message.slice(0, 500) },
      });
    }
  }
  return {
    alertDays: plan.setting.alertDays,
    dueCount: plan.allDue.length,
    milestoneCount: plan.milestones.length,
    recipientCount: plan.users.length,
    digestCount: plan.deliveries.length,
    forced: force,
    sent,
    skipped,
    failed,
    smtpResponses,
  };
}
