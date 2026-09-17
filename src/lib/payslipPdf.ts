/**
 * Payslip PDF — "Time Card / Salary Slip (FORM-25B)" layout, matching the
 * company's existing paper format exactly (header, two-column identity
 * block, Earnings/Deductions table, Net Pay + words, signature lines).
 * Same manual pdf-lib text-positioning approach as visitor-pdf.ts (this
 * codebase's only other PDF generator) — no table-grid helper exists here.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PayslipData } from './payslipReport';
import { rupeesInWords } from './numberToWords';

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function generatePayslipPdf(data: PayslipData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.4, 0.4, 0.4);

  const marginX = 45;
  const pageWidth = 595;
  let y = 800;

  const centerText = (text: string, size: number, f: PDFFont, color = black) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (pageWidth - w) / 2, y, size, font: f, color });
  };

  // ── Header ──
  centerText(data.companyName, 13, bold);
  y -= 15;
  if (data.companyAddress) {
    centerText(data.companyAddress.toUpperCase(), 8.5, font, gray);
    y -= 12;
  }
  if (data.factoryRegNo) {
    centerText(`FACTORY REG NO . ${data.factoryRegNo}`, 8.5, font, gray);
    y -= 16;
  }
  centerText(`Time Card /Salary Slip (FORM-25B) for the month of ${data.monthLabel}`, 9.5, bold);
  y -= 20;

  // ── Identity block (two columns) ──
  const leftX = marginX;
  const rightX = 320;
  const rowH = 14;
  const identityLeft: [string, string][] = [
    ['Emp ID', data.employeeCode],
    ['PF No.', data.pfNumber ?? ''],
    ['NOD Payable', String(data.nodPayable)],
    ['Designation', data.designation ?? ''],
    ['A/c No.', data.bankAccountNo ?? ''],
    ['Father Name', data.fatherName ?? ''],
    ['LOP.', String(data.lopDays)],
    ['NOD Working', String(data.nodWorking)],
  ];
  const identityRight: [string, string][] = [
    ['Employee Name:', data.employeeName],
    ['ESI No.', data.esiNumber ?? ''],
    ['D.O.J.', data.dateOfJoining ?? ''],
    ['Department', data.department ?? ''],
    ['PAN', data.panNumber ?? ''],
    ['UAN', data.uanNumber ?? ''],
  ];
  const startY = y;
  identityLeft.forEach(([label, value], i) => {
    const rowY = startY - i * rowH;
    page.drawText(label, { x: leftX, y: rowY, size: 8.5, font, color: black });
    page.drawText(value, { x: leftX + 90, y: rowY, size: 8.5, font: bold, color: black });
  });
  identityRight.forEach(([label, value], i) => {
    const rowY = startY - i * rowH;
    page.drawText(label, { x: rightX, y: rowY, size: 8.5, font, color: black });
    page.drawText(value, { x: rightX + 85, y: rowY, size: 8.5, font: bold, color: black });
  });
  y = startY - Math.max(identityLeft.length, identityRight.length) * rowH - 15;

  // ── Earnings / Deductions table ──
  const tableTop = y;
  const colEarnName = marginX;
  const colEarnAmt = 260;
  const colDedName = 320;
  const colDedAmt = 545;
  const lineColor = rgb(0.75, 0.75, 0.75);

  const drawRow = (rowY: number, earnName: string, earnAmt: string, dedName: string, dedAmt: string, f: PDFFont = font) => {
    page.drawText(earnName, { x: colEarnName, y: rowY, size: 8.5, font: f, color: black });
    if (earnAmt) page.drawText(earnAmt, { x: colEarnAmt - f.widthOfTextAtSize(earnAmt, 8.5), y: rowY, size: 8.5, font: f, color: black });
    page.drawText(dedName, { x: colDedName, y: rowY, size: 8.5, font: f, color: black });
    if (dedAmt) page.drawText(dedAmt, { x: colDedAmt - f.widthOfTextAtSize(dedAmt, 8.5), y: rowY, size: 8.5, font: f, color: black });
  };

  drawRow(tableTop, 'Earnings', '', 'Deductions', '', bold);
  drawRow(tableTop, '', 'Amount', '', 'Amount', bold);
  page.drawLine({ start: { x: marginX, y: tableTop - 6 }, end: { x: colDedAmt, y: tableTop - 6 }, thickness: 0.75, color: lineColor });

  const rowCount = Math.max(data.earnings.length, data.deductions.length);
  let rowY = tableTop - 20;
  for (let i = 0; i < rowCount; i++) {
    const e = data.earnings[i];
    const d = data.deductions[i];
    drawRow(rowY, e?.name ?? '', e ? fmt(e.amount) : '', d?.name ?? '', d ? fmt(d.amount) : '');
    rowY -= 15;
  }

  page.drawLine({ start: { x: marginX, y: rowY - 4 }, end: { x: colDedAmt, y: rowY - 4 }, thickness: 0.75, color: lineColor });
  rowY -= 18;
  drawRow(rowY, 'Total', fmt(data.totalEarnings), 'Total', fmt(data.totalDeductions), bold);
  page.drawLine({ start: { x: marginX, y: rowY - 6 }, end: { x: colDedAmt, y: rowY - 6 }, thickness: 1, color: black });
  page.drawLine({ start: { x: marginX, y: tableTop + 12 }, end: { x: marginX, y: rowY - 6 }, thickness: 0.75, color: lineColor });
  page.drawLine({ start: { x: colDedAmt, y: tableTop + 12 }, end: { x: colDedAmt, y: rowY - 6 }, thickness: 0.75, color: lineColor });
  page.drawLine({ start: { x: 300, y: tableTop + 12 }, end: { x: 300, y: rowY - 6 }, thickness: 0.75, color: lineColor });

  // ── Net Pay ──
  y = rowY - 26;
  page.drawText('Net Pay', { x: marginX, y, size: 9, font: bold, color: black });
  page.drawText(fmt(data.netPay), { x: marginX + 90, y, size: 9, font: bold, color: black });
  y -= 14;
  page.drawText('In Words', { x: marginX, y, size: 8.5, font, color: black });
  page.drawText(rupeesInWords(data.netPay), { x: marginX + 90, y, size: 8.5, font: bold, color: black });

  // ── Signature lines ──
  y -= 40;
  page.drawText('Signature of Employee', { x: marginX, y, size: 8.5, font, color: black });
  page.drawText('Signature of Factory Manager', { x: colDedName, y, size: 8.5, font, color: black });

  // ── Footer note (fixed near the bottom, independent of content length) ──
  y = 35;
  const generatedOn = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  centerText(`This is an auto-generated payslip by Suki HRMS on ${generatedOn}.`, 7.5, font, gray);

  return doc.save();
}
