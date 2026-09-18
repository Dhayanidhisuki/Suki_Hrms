/**
 * Performance Incentive Report — PDF export. Column set mirrors the
 * company's existing "PMS Incentives Register" export one-for-one (see
 * performanceIncentiveReport.ts header). Manual row-by-row text
 * positioning via pdf-lib, same low-level approach as visitor-pdf.ts (this
 * codebase has no table-grid PDF helper); a wide landscape page plus
 * pagination when rows overflow.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PerformanceIncentiveRow } from './performanceIncentiveReport';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const COLS: { key: keyof PerformanceIncentiveRow | 'sno'; label: string; width: number; align?: 'left' | 'right' }[] = [
  { key: 'sno', label: 'Sl No', width: 28 },
  { key: 'employeeCode', label: 'Emp ID', width: 48 },
  { key: 'employeeName', label: 'Employee Name', width: 100 },
  { key: 'monthYearLabel', label: 'Month/Yr', width: 42 },
  { key: 'department', label: 'Department', width: 85 },
  { key: 'designation', label: 'Designation', width: 85 },
  { key: 'dateOfJoining', label: 'DOJ', width: 55 },
  { key: 'category', label: 'Category', width: 48 },
  { key: 'ctcAmount', label: 'PMS INC FI', width: 55, align: 'right' },
  { key: 'daysInMonth', label: 'Cal Days', width: 40, align: 'right' },
  { key: 'lopDays', label: 'LOP', width: 35, align: 'right' },
  { key: 'presentDays', label: 'Pay Days', width: 45, align: 'right' },
  { key: 'pmsIncEarning', label: 'PMS Inc Earning', width: 65, align: 'right' },
  { key: 'percent', label: 'PMS %', width: 40, align: 'right' },
  { key: 'pmsIncent', label: 'PMS Incent', width: 55, align: 'right' },
  { key: 'esiEmployeeDeduction', label: 'EMP ESI(0.75%)', width: 60, align: 'right' },
  { key: 'esiEmployerContribution', label: 'Employer(3.25%)', width: 65, align: 'right' },
  { key: 'finalAmount', label: 'PMS NET', width: 55, align: 'right' },
  { key: 'bankAccountNo', label: 'Bank A/c No', width: 75 },
  { key: 'bankIfsc', label: 'Bank IFSC', width: 55 },
  { key: 'bankName', label: 'Bank Name', width: 90 },
  { key: 'remarks', label: 'Remarks', width: 75 },
];

function fmt(row: PerformanceIncentiveRow, key: string, idx: number): string {
  switch (key) {
    case 'sno': return String(idx + 1);
    case 'employeeCode': return row.employeeCode;
    case 'employeeName': return row.employeeName;
    case 'monthYearLabel': return row.monthYearLabel;
    case 'department': return row.department ?? '';
    case 'designation': return row.designation ?? '';
    case 'dateOfJoining': return row.dateOfJoining ?? '';
    case 'category': return row.category ?? '';
    case 'ctcAmount': return row.ctcAmount.toFixed(2);
    case 'daysInMonth': return String(row.daysInMonth);
    case 'lopDays': return row.lopDays.toFixed(2);
    case 'presentDays': return String(row.presentDays);
    case 'pmsIncEarning': return row.pmsIncEarning.toFixed(2);
    case 'percent': return row.percent === null ? '—' : row.percent.toFixed(2);
    case 'pmsIncent': return row.pmsIncent.toFixed(2);
    case 'esiEmployeeDeduction': return row.esiEligible ? row.esiEmployeeDeduction.toFixed(2) : '0.00';
    case 'esiEmployerContribution': return row.esiEligible ? row.esiEmployerContribution.toFixed(2) : '0.00';
    case 'finalAmount': return row.finalAmount.toFixed(2);
    case 'bankAccountNo': return row.bankAccountNo ?? '';
    case 'bankIfsc': return row.bankIfsc ?? '';
    case 'bankName': return row.bankName ?? '';
    case 'remarks': return row.remarks;
    default: return '';
  }
}

export async function generatePerformanceIncentivePdf(
  rows: PerformanceIncentiveRow[],
  meta: { companyName: string; year: number; month: number; scope: 'employee' | 'overall' }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = COLS.reduce((sum, c) => sum + c.width, 0) + 60;
  const pageHeight = 560;
  const marginX = 30;
  const rowHeight = 15;
  const headerY = pageHeight - 30;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = headerY;

  const drawHeader = (p: PDFPage) => {
    p.drawText(`${meta.companyName} — PMS Incentives Register (Performance Incentive Report)`, { x: marginX, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    const scopeLabel = meta.scope === 'employee' ? 'Employee-wise' : 'Overall';
    p.drawText(`For the month of ${MONTH_NAMES[meta.month]}-${String(meta.year).slice(-2)} · ${scopeLabel}`, { x: marginX, y, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 18;
    let x = marginX;
    for (const col of COLS) {
      p.drawText(col.label, { x, y, size: 7, font: bold, color: rgb(0.2, 0.2, 0.2) });
      x += col.width;
    }
    y -= 3;
    p.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    y -= rowHeight;
  };

  drawHeader(page);

  const writeRow = (p: PDFPage, cells: string[], f: PDFFont, size: number) => {
    let x = marginX;
    cells.forEach((text, i) => {
      const col = COLS[i];
      const maxChars = Math.floor(col.width / (size * 0.5));
      const clipped = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
      const w = font.widthOfTextAtSize(clipped, size);
      const drawX = col.align === 'right' ? x + col.width - w - 3 : x;
      p.drawText(clipped, { x: drawX, y, size, font: f, color: rgb(0.15, 0.15, 0.15) });
      x += col.width;
    });
    y -= rowHeight;
  };

  let totalFinal = 0;
  rows.forEach((row, idx) => {
    if (y < 40) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = headerY;
      drawHeader(page);
    }
    const cells = COLS.map((c) => fmt(row, c.key as string, idx));
    writeRow(page, cells, font, 6.5);
    totalFinal += row.finalAmount;
  });

  if (y < 40) {
    page = doc.addPage([pageWidth, pageHeight]);
    y = headerY;
  }
  y -= 6;
  page.drawLine({ start: { x: marginX, y: y + 10 }, end: { x: pageWidth - marginX, y: y + 10 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  page.drawText(`Total Employees: ${rows.length}`, { x: marginX, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Total PMS NET: ${totalFinal.toFixed(2)}`, { x: marginX + 200, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });

  return doc.save();
}
