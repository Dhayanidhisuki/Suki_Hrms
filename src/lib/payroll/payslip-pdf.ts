/**
 * Server-side payslip PDF + Document Module archival.
 *
 * The KUN Document Module BRD requires payroll documents to be "created in
 * their respective modules and automatically indexed here". The existing
 * /api/payroll/runs/[id]/payslip-pdf endpoint returns JSON for the browser to
 * print, so no file ever reaches the server and nothing could be indexed.
 * This module renders the same payslip server-side and hands it to the
 * Document Module, following the pattern in fnf-statement.ts.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '@/lib/platform/contracts';
import { ensureDocumentType, indexGeneratedPdf } from '@/lib/platform/document/index-document';
import { formatKunMonth, readKunLogoBytes } from '@/lib/fnf/kun-statement';
import { loadCompanyProfile } from '@/lib/company-profile';
import { stampDeterministicMetadata } from '@/lib/pdf-metadata';
import { ACCENT, wrapToWidth } from '@/lib/letter-template';
import { amountInWordsInr } from '@/lib/fnf/amount-in-words';

const BLACK = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.28, 0.28, 0.28);
const LINE = rgb(0.62, 0.62, 0.62);
const GRAY = rgb(0.847, 0.847, 0.847);
const WHITE = rgb(1, 1, 1);

// A4 usable width, same margins as the F&F statement.
const L = 32;
const R = 563;
const MID = 298; // earnings column | deductions column

function money(n: number | null | undefined): string {
  if (n == null) return '-';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function right(page: PDFPage, font: PDFFont, text: string, rightX: number, y: number, size: number, color = BLACK) {
  page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y, size, font, color });
}

/** Clip text to a column so a long component name cannot run into the amount. */
function clipped(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

export type PayslipLine = { name: string; amount: number };

export type PayslipData = {
  companyId: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string | null;
  companyEmail: string | null;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  month: number;
  year: number;
  totalWorkingDays: number;
  payableDays: number;
  lopDays: number;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
};

/** Load one employee's payslip for a run. Returns null when there is no line. */
export async function loadPayslip(companyId: number, runId: number, employeeId: number): Promise<PayslipData | null> {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId } });
  if (!run) return null;

  const line = await prisma.payrollLine.findFirst({
    where: { payrollRunId: runId, employeeId },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          companyId: true,
          // designation/department are relations, not scalars — take the names.
          jobInfos: {
            where: { effectiveTo: null },
            take: 1,
            select: { designation: { select: { name: true } }, department: { select: { name: true } } },
          },
        },
      },
      components: {
        include: { salaryComponent: { select: { name: true, type: true } } },
        orderBy: { salaryComponent: { type: 'asc' } },
      },
    },
  });
  if (!line) return null;

  const company = await loadCompanyProfile(companyId);
  const emp = line.employee;
  const earnings = line.components
    .filter((c) => c.salaryComponent.type === 'earning')
    .map((c) => ({ name: c.salaryComponent.name, amount: Number(c.amount) }));
  const deductions = line.components
    .filter((c) => c.salaryComponent.type === 'deduction')
    .map((c) => ({ name: c.salaryComponent.name, amount: Number(c.amount) }));

  const totalDeductions = Number(line.grossEarnings) - Number(line.netSalary);

  return {
    companyId,
    companyName: company?.name ?? 'Company',
    companyAddress: company?.address ?? '',
    companyPhone: company?.phone ?? null,
    companyEmail: company?.email ?? null,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
    designation: emp.jobInfos[0]?.designation?.name ?? null,
    department: emp.jobInfos[0]?.department?.name ?? null,
    month: run.month,
    year: run.year,
    totalWorkingDays: line.totalWorkingDays,
    payableDays: Number(line.payableDays),
    lopDays: line.lopDays,
    earnings,
    deductions,
    grossEarnings: Number(line.grossEarnings),
    totalDeductions,
    netSalary: Number(line.netSalary),
  };
}

export async function generatePayslipPdf(data: PayslipData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readKunLogoBytes();
  const logoImg = logoBytes ? await doc.embedPng(logoBytes) : null;

  // Anchored to the pay period so identical payslip data always produces
  // identical bytes — see pdf-metadata.ts for why this matters.
  stampDeterministicMetadata(doc, {
    anchor: new Date(Date.UTC(data.year, data.month - 1, 1)),
    title: `Payslip ${data.employeeCode} ${data.year}-${String(data.month).padStart(2, '0')}`,
  });

  let y = 812;

  // ── Header ────────────────────────────────────────────────────────────────
  const hHeader = 52;
  page.drawRectangle({ x: L, y: y - hHeader, width: R - L, height: hHeader, color: WHITE, borderColor: LINE, borderWidth: 0.6 });
  page.drawText(data.companyName, { x: L + 8, y: y - 18, size: 16, font: bold, color: BLACK });
  const contactLine = [data.companyPhone, data.companyEmail].filter(Boolean).join('  ·  ');
  page.drawText(data.companyAddress, { x: L + 8, y: y - 32, size: 8, font, color: MUTED });
  if (contactLine) right(page, font, contactLine, R - 8, y - 32, 8, MUTED);
  page.drawText(`Payslip for ${formatKunMonth(data.year, data.month)}`, { x: L + 8, y: y - 46, size: 11, font: bold, color: BLACK });
  page.drawLine({ start: { x: L, y: y - hHeader }, end: { x: R, y: y - hHeader }, thickness: 1, color: ACCENT });
  if (logoImg) {
    const maxH = hHeader - 14;
    const scale = Math.min(70 / logoImg.width, maxH / logoImg.height);
    page.drawImage(logoImg, {
      x: R - 8 - logoImg.width * scale,
      y: y - hHeader + (hHeader - logoImg.height * scale) / 2,
      width: logoImg.width * scale,
      height: logoImg.height * scale,
    });
  }
  y -= hHeader;

  // ── Employee / attendance grid ────────────────────────────────────────────
  const info: Array<[string, string, string, string]> = [
    ['Employee name', data.employeeName, 'Working days', String(data.totalWorkingDays)],
    ['Employee ID', data.employeeCode, 'Payable days', String(data.payableDays)],
    ['Designation', data.designation ?? '—', 'LOP days', String(data.lopDays)],
    ['Department', data.department ?? '—', 'Pay period', formatKunMonth(data.year, data.month)],
  ];
  for (const [l1, v1, l2, v2] of info) {
    page.drawRectangle({ x: L, y: y - 15, width: R - L, height: 15, borderColor: LINE, borderWidth: 0.6 });
    page.drawText(l1, { x: L + 4, y: y - 11, size: 8, font, color: MUTED });
    page.drawText(clipped(bold, v1, 8, 150), { x: L + 110, y: y - 11, size: 8, font: bold, color: BLACK });
    page.drawText(l2, { x: MID + 30, y: y - 11, size: 8, font, color: MUTED });
    right(page, bold, v2, R - 6, y - 11, 8);
    y -= 15;
  }

  y -= 10;

  // ── Earnings | Deductions, side by side ───────────────────────────────────
  const bandH = 16;
  page.drawRectangle({ x: L, y: y - bandH, width: MID - L, height: bandH, color: GRAY, borderColor: LINE, borderWidth: 0.6 });
  page.drawRectangle({ x: MID, y: y - bandH, width: R - MID, height: bandH, color: GRAY, borderColor: LINE, borderWidth: 0.6 });
  page.drawText('Earnings', { x: L + 6, y: y - 12, size: 9, font: bold, color: BLACK });
  right(page, bold, 'Amount', MID - 6, y - 12, 9);
  page.drawText('Deductions', { x: MID + 6, y: y - 12, size: 9, font: bold, color: BLACK });
  right(page, bold, 'Amount', R - 6, y - 12, 9);
  y -= bandH;

  const rows = Math.max(data.earnings.length, data.deductions.length);
  const rowH = 14;
  for (let i = 0; i < rows; i++) {
    page.drawRectangle({ x: L, y: y - rowH, width: MID - L, height: rowH, borderColor: LINE, borderWidth: 0.4 });
    page.drawRectangle({ x: MID, y: y - rowH, width: R - MID, height: rowH, borderColor: LINE, borderWidth: 0.4 });
    const e = data.earnings[i];
    if (e) {
      page.drawText(clipped(font, e.name, 8, 160), { x: L + 6, y: y - 10, size: 8, font, color: BLACK });
      right(page, font, money(e.amount), MID - 6, y - 10, 8);
    }
    const d = data.deductions[i];
    if (d) {
      page.drawText(clipped(font, d.name, 8, 160), { x: MID + 6, y: y - 10, size: 8, font, color: BLACK });
      right(page, font, money(d.amount), R - 6, y - 10, 8);
    }
    y -= rowH;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: L, y: y - bandH, width: MID - L, height: bandH, color: GRAY, borderColor: LINE, borderWidth: 0.6 });
  page.drawRectangle({ x: MID, y: y - bandH, width: R - MID, height: bandH, color: GRAY, borderColor: LINE, borderWidth: 0.6 });
  page.drawText('Gross earnings', { x: L + 6, y: y - 12, size: 9, font: bold, color: BLACK });
  right(page, bold, money(data.grossEarnings), MID - 6, y - 12, 9);
  page.drawText('Total deductions', { x: MID + 6, y: y - 12, size: 9, font: bold, color: BLACK });
  right(page, bold, money(data.totalDeductions), R - 6, y - 12, 9);
  y -= bandH;

  y -= 12;
  const netH = 22;
  page.drawRectangle({ x: L, y: y - netH, width: R - L, height: netH, color: WHITE, borderColor: LINE, borderWidth: 0.8 });
  page.drawText('Net salary payable', { x: L + 8, y: y - 15, size: 11, font: bold, color: BLACK });
  right(page, bold, money(data.netSalary), R - 8, y - 15, 12);
  y -= netH;

  y -= 14;
  page.drawText('Amount in words:', { x: L, y, size: 8, font, color: MUTED });
  for (const line of wrapToWidth(font, amountInWordsInr(data.netSalary), 8.5, R - L - 74)) {
    page.drawText(line, { x: L + 74, y, size: 8.5, font: bold, color: BLACK });
    y -= 11;
  }

  // Same footer rule and note as the letters, so everything filed in the
  // Document Module reads as one set.
  page.drawLine({ start: { x: L, y: 72 }, end: { x: R, y: 72 }, thickness: 0.4, color: LINE });
  page.drawText(
    'This is a computer-generated payslip and does not require a signature.',
    { x: L, y: 60, size: 7.5, font, color: MUTED },
  );

  return doc.save();
}

/**
 * Render and file one employee's payslip into the Document Module.
 *
 * Safe to call repeatedly: indexGeneratedPdf de-duplicates on the file hash,
 * so re-archiving an unchanged payslip returns null instead of a second copy.
 */
export async function archivePayslip(
  companyId: number,
  runId: number,
  employeeId: number,
  actor: PlatformActor,
): Promise<boolean> {
  const data = await loadPayslip(companyId, runId, employeeId);
  if (!data) return false;

  await ensureDocumentType(companyId, 'PAYSLIP', {
    name: 'Payslip',
    category: 'FINANCIAL',
    businessCategory: 'PAYROLL',
    uploadMode: 'HR_ONLY',
    appliesToEntity: 'EMPLOYEE',
    documentClass: 'CONFIDENTIAL',
    verificationRequired: false,
    allowedFileTypes: 'pdf',
    maxFileSizeMb: 10,
  });

  const pdf = await generatePayslipPdf(data);
  const indexed = await indexGeneratedPdf({
    companyId,
    documentTypeCode: 'PAYSLIP',
    ownerEntityId: employeeId,
    fileName: `Payslip-${data.employeeCode}-${data.year}-${String(data.month).padStart(2, '0')}.pdf`,
    bytes: Buffer.from(pdf),
    actor: { ...actor, source: 'system' },
  });
  return indexed != null;
}

/** Archive every payslip in a run. Returns how many new documents were filed. */
export async function archiveRunPayslips(companyId: number, runId: number, actor: PlatformActor): Promise<{ filed: number; skipped: number }> {
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId, payrollRun: { companyId } },
    select: { employeeId: true },
    orderBy: { employeeId: 'asc' },
  });
  let filed = 0;
  let skipped = 0;
  for (const line of lines) {
    // Sequential on purpose: each archive writes a file and a row, and a
    // payroll run can be thousands of employees.
    const created = await archivePayslip(companyId, runId, line.employeeId, actor);
    if (created) filed += 1;
    else skipped += 1;
  }
  return { filed, skipped };
}
