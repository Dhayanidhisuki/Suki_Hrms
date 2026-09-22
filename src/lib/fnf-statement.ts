import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '@/lib/platform/contracts';
import { ensureDocumentType, indexGeneratedPdf } from '@/lib/platform/document/index-document';
import { loadKunFnfStatement, readKunLogoBytes, type KunFnfStatement } from '@/lib/fnf/kun-statement';
import { stampDeterministicMetadata } from '@/lib/pdf-metadata';

const BLACK = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.28, 0.28, 0.28);
const LINE = rgb(0.62, 0.62, 0.62);
const GRAY = rgb(0.847, 0.847, 0.847);
const STATUS = rgb(0.55, 0.08, 0.08);
const WHITE = rgb(1, 1, 1);

function money(n: number | null | undefined): string {
  if (n == null) return '-';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dashMoney(n: number | null | undefined): string {
  if (n == null || n === 0) return '-';
  return money(n);
}

/** B label | C value | D Actual / eligibility | E Earned | F remark — A4 usable width. */
const L = 32;
const R = 563;
const C = { b: 32, c: 168, d: 304, e: 392, f: 478, end: 563 };
const W = {
  b: C.c - C.b,
  c: C.d - C.c,
  d: C.e - C.d,
  e: C.f - C.e,
  f: C.end - C.f,
};

export async function generateFnfStatementPdf(settlementId: number): Promise<Uint8Array> {
  const stmt = await loadKunFnfStatement(settlementId);
  if (!stmt) throw new Error('Settlement not found');

  const doc = await PDFDocument.create();
  // The statement's own dates are display strings, so there is no date to
  // anchor to — the fixed fallback still makes the bytes reproducible, which
  // is what the Document Module's hash de-duplication needs.
  stampDeterministicMetadata(doc, { title: `${stmt.title} — ${stmt.employeeCode}` });
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readKunLogoBytes();
  const logoImg = logoBytes ? await doc.embedPng(logoBytes) : null;

  let y = 812;
  const hHeader = 52;
  page.drawRectangle({
    x: L,
    y: y - hHeader,
    width: R - L,
    height: hHeader,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 0.6,
  });
  page.drawText(stmt.companyName, { x: L + 8, y: y - 18, size: 16, font: bold, color: BLACK });
  page.drawText(stmt.companyAddress, { x: L + 8, y: y - 32, size: 8, font, color: MUTED });
  page.drawText(stmt.title, { x: L + 8, y: y - 46, size: 11, font: bold, color: BLACK });
  y -= hHeader;

  const infoTop = y;
  const info = [
    ['Name of the employee', stmt.employeeName, 'F & F Date', stmt.fnfDate],
    ['Employee ID', stmt.employeeCode, 'Resignation Date', stmt.resignationDate],
    ['Designation', stmt.designation, 'Date of Joining', stmt.joinDate],
    ['Department', stmt.department, 'Date of Leaving', stmt.leavingDate],
  ];
  const infoH = 15 * info.length;
  for (const [l1, v1, l2, v2] of info) {
    rowBox(page, y, 15);
    vline(page, C.c, y, 15);
    vline(page, C.d, y, 15);
    vline(page, C.e, y, 15);
    left(page, font, l1, C.b + 4, y - 11, 8, MUTED, C.c);
    left(page, bold, v1 || '—', C.c + 4, y - 11, 8, BLACK, C.d);
    left(page, font, l2, C.d + 4, y - 11, 8, MUTED, C.e);
    left(page, bold, v2 || '—', C.e + 4, y - 11, 8, BLACK, C.f);
    y -= 15;
  }
  if (logoImg) {
    const maxH = infoH - 8;
    const maxW = W.f + 8;
    const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const w = logoImg.width * scale;
    const h = logoImg.height * scale;
    page.drawImage(logoImg, {
      x: C.end - 6 - w,
      y: infoTop - infoH + (infoH - h) / 2,
      width: w,
      height: h,
    });
  }

  band(page, bold, y, 16, 'Salary Particulars', `For the Month    ${stmt.salaryMonth}`);
  y -= 16;

  rowBox(page, y, 14);
  vline(page, C.c, y, 14);
  vline(page, C.d, y, 14);
  left(page, font, 'Total Days in the Month', C.b + 4, y - 10, 8, MUTED, C.c);
  left(page, bold, String(stmt.totalDays), C.c + 4, y - 10, 8, BLACK, C.d);
  left(page, font, 'Paid days', C.d + 4, y - 10, 8, MUTED, C.e);
  left(page, bold, String(stmt.paidDays), C.e + 4, y - 10, 8, BLACK, C.f);
  y -= 14;

  headAmt(page, bold, y, 'Earnings', 'Actual', 'Earned');
  y -= 14;
  for (const r of stmt.earnings) {
    amtRow(page, font, bold, y, r.label, r.actual, r.earned, false, false);
    y -= 14;
  }
  amtRow(page, font, bold, y, 'Total', stmt.earningTotalActual, stmt.earningTotalEarned, true, false);
  y -= 14;

  band(page, bold, y, 16, 'Less Deductions (-)', '');
  y -= 16;
  for (const r of stmt.deductions) {
    amtRow(page, font, bold, y, r.label, r.actual, r.earned, false, true);
    y -= 14;
  }
  amtRow(page, font, bold, y, 'Total Deductions', stmt.deductionTotalActual, stmt.deductionTotalEarned, true, true);
  y -= 14;
  amtRow(page, font, bold, y, 'Net Salary (For Current Month)', stmt.netSalaryActual, stmt.netSalaryEarned, true, false, stmt.salaryStatus);
  y -= 14;

  band(page, bold, y, 16, 'Other Earnings', '');
  y -= 16;
  headAmt(page, bold, y, '', 'Eligibility Period', '');
  y -= 14;

  otherRow(page, font, bold, y, 'Earned Leave Encashment (Days)', String(stmt.leaveDays || '-'), stmt.leaveAmount, '');
  y -= 14;
  otherRow(page, font, bold, y, 'Gratutity (Eligible)', stmt.gratuityPeriod || '-', stmt.gratuityAmount, stmt.gratuityRemark);
  y -= 14;
  otherRow(
    page,
    font,
    bold,
    y,
    'Incentives',
    stmt.incentiveActual != null ? money(stmt.incentiveActual) : '-',
    stmt.incentiveEarned,
    stmt.incentiveRemark,
  );
  y -= 14;
  otherRow(page, font, bold, y, 'Bonus', stmt.bonusPeriod, stmt.bonusAmount, '');
  y -= 14;
  otherRow(page, font, bold, y, 'Total', '', stmt.otherTotal, '', true);
  y -= 14;
  otherRow(page, font, bold, y, 'Net Payable (Rs)', '', stmt.netPayable, stmt.netStatus, true);
  y -= 14;

  const wordsH = 22;
  rowBox(page, y, wordsH);
  vline(page, C.c, y, wordsH);
  left(page, bold, 'Amount in Words', C.b + 4, y - 13, 8, BLACK);
  wrap(page, font, stmt.amountInWords, C.c + 4, y - 13, 8, R - C.c - 10);
  y -= wordsH;

  const signH = 36;
  rowBox(page, y, signH);
  const signW = (R - L) / 4;
  for (let i = 1; i < 4; i++) vline(page, L + signW * i, y, signH);
  const roles: [string, string][] = [
    ['Prepared By', 'EXECUTIVE - HR'],
    ['Verified By', 'MANAGER - HR & ADMIN'],
    ['Approval 1', 'CEO'],
    ['Approval 2', 'FINANCE - HEAD'],
  ];
  roles.forEach((r, i) => {
    const x = L + signW * i + 6;
    left(page, bold, r[0], x, y - 12, 8, BLACK);
    left(page, font, r[1], x, y - 24, 7, MUTED);
  });
  y -= signH;

  band(page, bold, y, 16, 'Declaration', '');
  y -= 16;
  const declH = 28;
  rowBox(page, y, declH);
  wrap(
    page,
    font,
    'I have received full and final settlement of my account with the Company and confirm that all dues to me from the Company are cleared.',
    L + 6,
    y - 12,
    8,
    R - L - 12,
  );
  y -= declH;

  const footH = 28;
  rowBox(page, y, footH);
  vline(page, C.d, y, footH);
  left(page, font, 'Employee Signature', C.b + 4, y - 18, 8, BLACK);
  page.drawLine({ start: { x: C.b + 108, y: y - 20 }, end: { x: C.d - 10, y: y - 20 }, thickness: 0.5, color: LINE });
  left(page, font, 'Date:', C.d + 6, y - 18, 8, BLACK);
  page.drawLine({ start: { x: C.d + 36, y: y - 20 }, end: { x: R - 10, y: y - 20 }, thickness: 0.5, color: LINE });

  // Compile-time guard that the loader's return still matches the template's
  // shape. Parenthesised because `void` binds tighter than `satisfies`:
  // `void stmt satisfies T` asserts `undefined satisfies T`, which is both
  // meaningless and a type error.
  void (stmt satisfies KunFnfStatement);
  return doc.save();
}

function rowBox(page: PDFPage, y: number, h: number) {
  page.drawRectangle({
    x: L,
    y: y - h,
    width: R - L,
    height: h,
    borderColor: LINE,
    borderWidth: 0.45,
    color: WHITE,
  });
}

function vline(page: PDFPage, x: number, y: number, h: number) {
  page.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness: 0.45, color: LINE });
}

function band(page: PDFPage, bold: PDFFont, y: number, h: number, title: string, extra: string) {
  page.drawRectangle({
    x: L,
    y: y - h,
    width: R - L,
    height: h,
    color: GRAY,
    borderColor: LINE,
    borderWidth: 0.45,
  });
  left(page, bold, title, L + 6, y - 11, 9, BLACK);
  if (extra) right(page, bold, extra, R - 8, y - 11, 8, BLACK);
}

function headAmt(page: PDFPage, bold: PDFFont, y: number, leftLabel: string, dLabel: string, eLabel: string) {
  rowBox(page, y, 14);
  vline(page, C.d, y, 14);
  vline(page, C.e, y, 14);
  vline(page, C.f, y, 14);
  if (leftLabel) left(page, bold, leftLabel, C.b + 4, y - 10, 8, BLACK, C.d);
  if (dLabel) center(page, bold, dLabel, C.d, C.e, y - 10, 8, BLACK);
  if (eLabel) center(page, bold, eLabel, C.e, C.f, y - 10, 8, BLACK);
}

function amtRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  y: number,
  label: string,
  actual: number | null | undefined,
  earned: number | null | undefined,
  strong: boolean,
  dashZero: boolean,
  remark = '',
) {
  rowBox(page, y, 14);
  vline(page, C.d, y, 14);
  vline(page, C.e, y, 14);
  vline(page, C.f, y, 14);
  const f = strong ? bold : font;
  left(page, f, label, C.b + 4, y - 10, 8, BLACK, C.d);
  right(page, f, dashZero ? dashMoney(actual) : money(actual), C.e - 5, y - 10, 8, BLACK);
  right(page, f, dashZero ? dashMoney(earned) : money(earned), C.f - 5, y - 10, 8, BLACK);
  if (remark) left(page, bold, remark, C.f + 3, y - 10, 6.5, STATUS, C.end);
}

function otherRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  y: number,
  label: string,
  mid: string,
  amount: number,
  remark: string,
  strong = false,
) {
  rowBox(page, y, 14);
  vline(page, C.d, y, 14);
  vline(page, C.e, y, 14);
  vline(page, C.f, y, 14);
  const f = strong ? bold : font;
  left(page, f, label, C.b + 4, y - 10, 8, BLACK, C.d);
  center(page, f, mid, C.d, C.e, y - 10, 7.5, BLACK);
  right(page, f, money(amount), C.f - 5, y - 10, 8, BLACK);
  if (remark) left(page, bold, remark, C.f + 3, y - 10, 6.5, STATUS, C.end);
}

function left(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  maxX = C.end,
) {
  if (!text) return;
  page.drawText(clip(font, text, size, maxX - x - 3), { x, y, size, font, color });
}

function right(page: PDFPage, font: PDFFont, text: string, rightX: number, y: number, size: number, color: ReturnType<typeof rgb>) {
  const t = text || '';
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: rightX - w, y, size, font, color });
}

function center(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x0: number,
  x1: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  if (!text) return;
  const t = clip(font, text, size, x1 - x0 - 4);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: x0 + (x1 - x0 - w) / 2, y, size, font, color });
}

function clip(font: PDFFont, text: string, size: number, max: number): string {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > max) t = t.slice(0, -1);
  return `${t}…`;
}

function wrap(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, maxW: number) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxW && line) {
      page.drawText(line, { x, y: cy, size, font, color: BLACK });
      cy -= size + 2;
      line = w;
    } else line = next;
  }
  if (line) page.drawText(line, { x, y: cy, size, font, color: BLACK });
}

export async function archiveFnfStatement(settlementId: number, actor: PlatformActor): Promise<void> {
  const s = await prisma.fnFSettlement.findUnique({
    where: { id: settlementId },
    include: { employee: { select: { employeeCode: true, companyId: true } } },
  });
  if (!s) return;
  const pdf = await generateFnfStatementPdf(settlementId);
  const bytes = Buffer.from(pdf);
  await ensureDocumentType(s.companyId, 'FNF_STATEMENT', {
    name: 'Full and final settlement statement',
    category: 'EXIT',
    businessCategory: 'PAYROLL',
    uploadMode: 'HR_ONLY',
    appliesToEntity: 'EMPLOYEE',
    documentClass: 'RESTRICTED',
    verificationRequired: false,
    allowedFileTypes: 'pdf',
    maxFileSizeMb: 10,
  });
  await indexGeneratedPdf({
    companyId: s.companyId,
    documentTypeCode: 'FNF_STATEMENT',
    ownerEntityId: s.employeeId,
    fileName: `FNF-${s.employee.employeeCode}.pdf`,
    bytes,
    actor: { ...actor, source: 'system' },
  });
}
