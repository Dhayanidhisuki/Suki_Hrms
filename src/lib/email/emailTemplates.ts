/**
 * emailTemplates.ts
 * ─────────────────
 * Branded, responsive, dark-mode-safe HTML email templates for SUKI ERP
 * calibration notifications.
 *
 * All styles are inline (required for email clients).
 * Tables-based layout for maximum client compatibility (Outlook, Gmail, Apple Mail).
 */

import type { DueCalibrationTool, NotificationUser } from "@/lib/calibrationDueEmail";

// ─── Brand tokens ──────────────────────────────────────────────────────────────

const BRAND = {
  name: "SUKI ERP",
  module: "Tools Management",
  primary: "#1a56db",       // blue — matches app accent
  primaryDark: "#1e429f",
  overdue: "#c81e1e",
  dueSoon: "#b45309",
  dueToday: "#6d28d9",
  ok: "#166534",
  bgHeader: "#0f172a",      // slate-900
  bgBody: "#f8fafc",        // slate-50
  bgCard: "#ffffff",
  bgRow: "#f1f5f9",         // slate-100 for alternating rows
  textPrimary: "#0f172a",   // slate-900
  textSecondary: "#475569", // slate-600
  textMuted: "#94a3b8",     // slate-400
  borderLight: "#e2e8f0",   // slate-200
  fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[c]!);
}

function unitLabel(value: string | null) {
  return value?.replace(/^UNIT/, "Unit ") ?? "Not assigned";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

type StatusMeta = {
  label: string;
  color: string;
  bg: string;
  emoji: string;
};

function statusMeta(item: DueCalibrationTool): StatusMeta {
  if (item.dueStatus === "OVERDUE") {
    return {
      label: `${Math.abs(item.daysRemaining)} day${Math.abs(item.daysRemaining) !== 1 ? "s" : ""} overdue`,
      color: BRAND.overdue,
      bg: "#fff1f2",
      emoji: "🔴",
    };
  }
  if (item.dueStatus === "DUE_TODAY") {
    return { label: "Due today", color: BRAND.dueToday, bg: "#faf5ff", emoji: "🟣" };
  }
  return {
    label: `${item.daysRemaining} day${item.daysRemaining !== 1 ? "s" : ""} remaining`,
    color: BRAND.dueSoon,
    bg: "#fffbeb",
    emoji: "🟡",
  };
}

// ─── Shared layout wrappers ────────────────────────────────────────────────────

function emailWrapper(contentHtml: string, previewText = ""): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Calibration Reminder — ${escapeHtml(BRAND.name)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgBody};font-family:${BRAND.fontFamily};-webkit-font-smoothing:antialiased;">
  <!-- Preview text (hidden) -->
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgBody};min-width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px 40px;">

        <!-- ── Email card ── -->
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.borderLight};">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.bgHeader};padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#64748b;">Tools Management System</p>
                    <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.3px;">${escapeHtml(BRAND.name)}</p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background-color:${BRAND.primary};color:#ffffff;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 12px;border-radius:20px;">Calibration Alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:${BRAND.bgCard};padding:32px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;border-top:1px solid ${BRAND.borderLight};padding:20px 32px;">
              <p style="margin:0;font-size:11px;color:${BRAND.textMuted};line-height:1.7;">
                This is an automated reminder from <strong>${escapeHtml(BRAND.name)} ${escapeHtml(BRAND.module)}</strong>.<br />
                Please do not reply to this email. For queries, contact your Quality or Calibration team.<br />
                <span style="color:#cbd5e1;">&copy; ${year} ${escapeHtml(BRAND.name)}. All rights reserved.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Single-tool template (used for TEST emails) ───────────────────────────────

export function singleToolTemplate(item: DueCalibrationTool): string {
  const meta = statusMeta(item);
  const toolName = escapeHtml(item.name || item.description || "—");

  const content = `
    <!-- Status badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${meta.bg};border-left:4px solid ${meta.color};border-radius:6px;padding:14px 18px;">
          <p style="margin:0;font-size:14px;font-weight:600;color:${meta.color};">${meta.emoji}&nbsp; ${escapeHtml(meta.label.charAt(0).toUpperCase() + meta.label.slice(1))}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${BRAND.textSecondary};">Calibration action is required for the instrument listed below.</p>
        </td>
      </tr>
    </table>

    <!-- Tool detail card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.borderLight};border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background-color:#f8fafc;">
        <td colspan="2" style="padding:12px 18px;border-bottom:1px solid ${BRAND.borderLight};">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textMuted};">Instrument Details</p>
        </td>
      </tr>
      ${detailRow("Tool / Gauge No.", escapeHtml(item.toolOrGaugeNo), true)}
      ${detailRow("Tool Name", toolName)}
      ${detailRow("Unit", escapeHtml(unitLabel(item.unitCode)), true)}
      ${detailRow("Due Date", `<strong style="color:${meta.color};">${formatDate(item.dueDate)}</strong>`)}
      ${detailRow("Status", `<span style="background-color:${meta.bg};color:${meta.color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">${escapeHtml(meta.label)}</span>`, true)}
    </table>

    <!-- CTA note -->
    <p style="margin:0;font-size:13px;color:${BRAND.textSecondary};line-height:1.7;">
      Please ensure the instrument is scheduled for calibration at your earliest convenience.
      Log into the Tools Management System to update the calibration record.
    </p>
  `;

  return emailWrapper(content, `Calibration ${item.dueStatus === "OVERDUE" ? "overdue" : "due"}: ${item.toolOrGaugeNo}`);
}

// ─── Digest template (one email per user, multiple tools) ──────────────────────

export function digestTemplate(user: NotificationUser, items: DueCalibrationTool[]): string {
  const overdue = items.filter((i) => i.dueStatus === "OVERDUE");
  const dueToday = items.filter((i) => i.dueStatus === "DUE_TODAY");
  const dueSoon = items.filter((i) => i.dueStatus === "DUE_SOON");

  const summaryCards = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        ${overdue.length ? summaryCard(String(overdue.length), "Overdue", BRAND.overdue, "#fff1f2") : ""}
        ${dueToday.length ? summaryCard(String(dueToday.length), "Due Today", BRAND.dueToday, "#faf5ff") : ""}
        ${dueSoon.length ? summaryCard(String(dueSoon.length), "Due Soon", BRAND.dueSoon, "#fffbeb") : ""}
      </tr>
    </table>
  `;

  // Build rows for each item
  const tableRows = items.map((item, idx) => {
    const meta = statusMeta(item);
    const bg = idx % 2 === 0 ? BRAND.bgCard : BRAND.bgRow;
    return `
      <tr style="background-color:${bg};">
        <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.borderLight};font-size:13px;font-weight:600;color:${BRAND.textPrimary};white-space:nowrap;">${escapeHtml(item.toolOrGaugeNo)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.borderLight};font-size:13px;color:${BRAND.textPrimary};">${escapeHtml(item.name || item.description || "—")}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.borderLight};font-size:12px;color:${BRAND.textSecondary};white-space:nowrap;">${escapeHtml(unitLabel(item.unitCode))}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.borderLight};font-size:12px;color:${BRAND.textSecondary};white-space:nowrap;">${formatDate(item.dueDate)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.borderLight};white-space:nowrap;">
          <span style="background-color:${meta.bg};color:${meta.color};font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">${meta.emoji} ${escapeHtml(meta.label)}</span>
        </td>
      </tr>`;
  }).join("");

  const content = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:${BRAND.textPrimary};">Hello, ${escapeHtml(user.name)} 👋</p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.textSecondary};line-height:1.6;">
      You have <strong>${items.length} calibration reminder${items.length !== 1 ? "s" : ""}</strong> that match your role
      (<strong>${escapeHtml(user.roleName)}</strong>) and unit scope. Please review and take action as needed.
    </p>

    ${summaryCards}

    <!-- Instruments table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.borderLight};border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background-color:${BRAND.bgHeader};">
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;white-space:nowrap;">Tool / Gauge No.</th>
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Tool Name</th>
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;white-space:nowrap;">Unit</th>
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;white-space:nowrap;">Due Date</th>
        <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Status</th>
      </tr>
      ${tableRows}
    </table>

    <!-- Action note -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background-color:#eff6ff;border-left:4px solid ${BRAND.primary};border-radius:6px;padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
            <strong>Next step:</strong> Log into the SUKI ERP Tools Management System to schedule or record calibration
            for any overdue or approaching instruments. Overdue instruments must be prioritised immediately.
          </p>
        </td>
      </tr>
    </table>
  `;

  const overdueCount = overdue.length;
  const preview = overdueCount > 0
    ? `⚠️ ${overdueCount} instrument${overdueCount !== 1 ? "s" : ""} overdue — ${items.length} calibration reminder${items.length !== 1 ? "s" : ""} require your attention`
    : `📋 ${items.length} calibration reminder${items.length !== 1 ? "s" : ""} for your review`;

  return emailWrapper(content, preview);
}

// ─── Test-mode wrapper (wraps singleToolTemplate with TEST banner) ─────────────

export function testEmailTemplate(item: DueCalibrationTool): string {
  const meta = statusMeta(item);
  const toolName = escapeHtml(item.name || item.description || "—");

  const content = `
    <!-- TEST banner -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background-color:#fef3c7;border:2px dashed #d97706;border-radius:8px;padding:14px 18px;text-align:center;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#92400e;">🧪 TEST EMAIL — This is a system configuration test.</p>
          <p style="margin:4px 0 0;font-size:12px;color:#b45309;">No production notification was consumed. This tool's real reminder will send on schedule.</p>
        </td>
      </tr>
    </table>

    <!-- Status badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${meta.bg};border-left:4px solid ${meta.color};border-radius:6px;padding:14px 18px;">
          <p style="margin:0;font-size:14px;font-weight:600;color:${meta.color};">${meta.emoji}&nbsp; ${escapeHtml(meta.label.charAt(0).toUpperCase() + meta.label.slice(1))}</p>
          <p style="margin:4px 0 0;font-size:12px;color:${BRAND.textSecondary};">Sample instrument used for SMTP delivery verification.</p>
        </td>
      </tr>
    </table>

    <!-- Tool detail card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.borderLight};border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background-color:#f8fafc;">
        <td colspan="2" style="padding:12px 18px;border-bottom:1px solid ${BRAND.borderLight};">
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.textMuted};">Instrument Details</p>
        </td>
      </tr>
      ${detailRow("Tool / Gauge No.", escapeHtml(item.toolOrGaugeNo), true)}
      ${detailRow("Tool Name", toolName)}
      ${detailRow("Unit", escapeHtml(unitLabel(item.unitCode)), true)}
      ${detailRow("Due Date", `<strong style="color:${meta.color};">${formatDate(item.dueDate)}</strong>`)}
      ${detailRow("Status", `<span style="background-color:${meta.bg};color:${meta.color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">${escapeHtml(meta.label)}</span>`, true)}
    </table>

    <p style="margin:0;font-size:13px;color:${BRAND.textSecondary};line-height:1.7;">
      SMTP is configured correctly. If you received this email, email delivery from
      <strong>${escapeHtml(BRAND.name)} Tools Management</strong> is working as expected.
    </p>
  `;

  return emailWrapper(content, `[TEST] SMTP verification — ${item.toolOrGaugeNo} (${item.dueStatus.toLowerCase().replace("_", " ")})`);
}

// ─── Private helpers ───────────────────────────────────────────────────────────

function detailRow(label: string, valueHtml: string, shaded = false): string {
  const bg = shaded ? "#f8fafc" : BRAND.bgCard;
  return `
    <tr style="background-color:${bg};">
      <td style="padding:11px 18px;border-bottom:1px solid ${BRAND.borderLight};font-size:12px;font-weight:600;color:${BRAND.textMuted};white-space:nowrap;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:11px 18px;border-bottom:1px solid ${BRAND.borderLight};font-size:13px;color:${BRAND.textPrimary};">${valueHtml}</td>
    </tr>`;
}

function summaryCard(count: string, label: string, color: string, bg: string): string {
  return `
    <td style="padding:0 6px 0 0;width:33.3%;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};border:1px solid ${color}20;border-radius:8px;">
        <tr>
          <td style="padding:14px 18px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:800;color:${color};">${escapeHtml(count)}</p>
            <p style="margin:2px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${color};">${escapeHtml(label)}</p>
          </td>
        </tr>
      </table>
    </td>`;
}
