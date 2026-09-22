/**
 * Generic table → PDF helper for report exports.
 *
 * performanceIncentivePdf.ts notes that "this codebase has no table-grid PDF
 * helper" and hand-positions its own rows as a result. This is that helper,
 * extracted from the same pdf-lib approach so the output matches what's
 * already shipping: landscape page sized to the column set, repeated header
 * on every page, right-aligned numerics, per-cell clipping, optional totals
 * footer.
 *
 * Column widths are in points and are the caller's responsibility — the page
 * grows to fit them, so a wide column set produces a wide page rather than
 * overlapping text.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface PdfColumn<T> {
  label: string;
  width: number;
  align?: 'left' | 'right';
  /** Cell text for this row. `index` is the 0-based row number across the whole report. */
  value: (row: T, index: number) => string;
}

export interface ReportTablePdfOptions<T> {
  title: string;
  subtitle?: string;
  columns: PdfColumn<T>[];
  rows: T[];
  /** Rendered on a summary line under the table, e.g. totals or row counts. */
  footer?: { label: string; value: string }[];
  /** Shown in place of the table when `rows` is empty. */
  emptyMessage?: string;
}

const PAGE_HEIGHT = 560;
const MARGIN_X = 30;
const ROW_HEIGHT = 15;
const BODY_SIZE = 6.5;
const BOTTOM_LIMIT = 40;

/** Trims a cell to what fits its column, with an ellipsis when cut. */
function clip(text: string, width: number, size: number): string {
  const maxChars = Math.floor(width / (size * 0.5));
  if (maxChars <= 1) return '';
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

export async function generateReportTablePdf<T>(options: ReportTablePdfOptions<T>): Promise<Uint8Array> {
  const { title, subtitle, columns, rows, footer, emptyMessage } = options;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = columns.reduce((sum, c) => sum + c.width, 0) + 60;
  const headerY = PAGE_HEIGHT - 30;

  let page = doc.addPage([pageWidth, PAGE_HEIGHT]);
  let y = headerY;

  const drawPageHeader = (p: PDFPage) => {
    p.drawText(title, { x: MARGIN_X, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    if (subtitle) {
      p.drawText(subtitle, { x: MARGIN_X, y, size: 9.5, font, color: rgb(0.35, 0.35, 0.35) });
    }
    y -= 18;
    let x = MARGIN_X;
    for (const col of columns) {
      p.drawText(clip(col.label, col.width, 7), { x, y, size: 7, font: bold, color: rgb(0.2, 0.2, 0.2) });
      x += col.width;
    }
    y -= 3;
    p.drawLine({ start: { x: MARGIN_X, y }, end: { x: pageWidth - MARGIN_X, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    y -= ROW_HEIGHT;
  };

  const newPage = () => {
    page = doc.addPage([pageWidth, PAGE_HEIGHT]);
    y = headerY;
    drawPageHeader(page);
  };

  drawPageHeader(page);

  if (rows.length === 0) {
    page.drawText(emptyMessage ?? 'No records for this period.', {
      x: MARGIN_X, y, size: 9, font, color: rgb(0.45, 0.45, 0.45),
    });
    return doc.save();
  }

  const writeRow = (p: PDFPage, row: T, index: number, f: PDFFont) => {
    let x = MARGIN_X;
    for (const col of columns) {
      const text = clip(col.value(row, index), col.width, BODY_SIZE);
      const w = f.widthOfTextAtSize(text, BODY_SIZE);
      const drawX = col.align === 'right' ? x + col.width - w - 3 : x;
      p.drawText(text, { x: drawX, y, size: BODY_SIZE, font: f, color: rgb(0.15, 0.15, 0.15) });
      x += col.width;
    }
    y -= ROW_HEIGHT;
  };

  rows.forEach((row, idx) => {
    if (y < BOTTOM_LIMIT) newPage();
    writeRow(page, row, idx, font);
  });

  if (footer && footer.length > 0) {
    // Keep the footer with at least the rule above it; start a fresh page
    // rather than letting it collide with the bottom edge.
    if (y < BOTTOM_LIMIT + ROW_HEIGHT) {
      page = doc.addPage([pageWidth, PAGE_HEIGHT]);
      y = headerY;
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN_X, y: y + 10 }, end: { x: pageWidth - MARGIN_X, y: y + 10 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    let x = MARGIN_X;
    for (const item of footer) {
      page.drawText(`${item.label}: ${item.value}`, { x, y, size: 9, font: bold, color: rgb(0.1, 0.1, 0.1) });
      x += 200;
    }
  }

  return doc.save();
}
