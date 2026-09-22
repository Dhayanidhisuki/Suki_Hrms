/**
 * Shared KUN letterhead for every generated PDF that a person downloads or
 * previews from the Document Module.
 *
 * Before this existed, only the F&F statement and the payslip carried the KUN
 * logo — confirmation letters and every generic HR letter (service, bonafide,
 * warning, show-cause, relieving) rendered as bare text with no branding,
 * address, reference or footer. Keeping the letterhead here means one KUN
 * template, applied identically everywhere, instead of a copy per generator.
 */

import { StandardFonts, rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { readKunLogoBytes } from '@/lib/fnf/kun-statement';

export const INK = rgb(0.13, 0.13, 0.13);
export const MUTED = rgb(0.38, 0.38, 0.38);
export const RULE = rgb(0.55, 0.55, 0.55);
export const ACCENT = rgb(0.12, 0.21, 0.45);

/** A4 portrait, with the margins the letters already used. */
export const PAGE = { width: 595.28, height: 841.89 };
export const M = { left: 56, right: 539, top: 800, bottom: 56 };

export type LetterChrome = {
  font: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
};

/** Embed the fonts and the KUN logo once per document. */
export async function prepareChrome(doc: PDFDocument): Promise<LetterChrome> {
  const [font, bold] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const bytes = await readKunLogoBytes();
  // A missing logo must never break letter generation — the letter still
  // needs to be issued, just without the mark.
  const logo = bytes ? await doc.embedPng(bytes).catch(() => null) : null;
  return { font, bold, logo };
}

/** Wrap on measured glyph width rather than character count, so lines fill the column evenly. */
export function wrapToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawCentered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (M.left + M.right - w) / 2, y, size, font, color });
}

export function drawRight(page: PDFPage, font: PDFFont, text: string, rightX: number, y: number, size: number, color = INK) {
  page.drawText(text, { x: rightX - font.widthOfTextAtSize(text, size), y, size, font, color });
}

/**
 * Company mark + address, a rule, the document title, and the Ref/Date row.
 * Returns the y the body should start at.
 */
export function drawLetterhead(
  page: PDFPage,
  chrome: LetterChrome,
  opts: {
    companyName: string;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    title: string;
    referenceNo?: string | null;
    date?: string | null;
  },
): number {
  const { font, bold, logo } = chrome;
  let y = M.top;

  // Logo sits top-right, balanced against the company name on the left, the
  // same arrangement the F&F statement and payslip already use.
  if (logo) {
    const h = 30;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M.right - w, y: y - h + 6, width: w, height: h });
  }

  page.drawText(opts.companyName, { x: M.left, y: y - 12, size: 15, font: bold, color: INK });
  // Address comes from the Company record via loadCompanyProfile(); a company
  // with none simply prints no address line rather than borrowing another's.
  for (const line of wrapToWidth(font, opts.companyAddress ?? '', 8, 300)) {
    y -= 12;
    page.drawText(line, { x: M.left, y: y - 12, size: 8, font, color: MUTED });
  }
  const contact = [opts.companyPhone, opts.companyEmail].filter(Boolean).join('  ·  ');
  if (contact) {
    y -= 12;
    page.drawText(contact, { x: M.left, y: y - 12, size: 8, font, color: MUTED });
  }

  y -= 26;
  page.drawLine({ start: { x: M.left, y }, end: { x: M.right, y }, thickness: 1, color: ACCENT });

  y -= 26;
  drawCentered(page, bold, opts.title.toUpperCase(), y, 12.5);

  y -= 8;
  page.drawLine({ start: { x: M.left, y: y - 4 }, end: { x: M.right, y: y - 4 }, thickness: 0.4, color: RULE });

  if (opts.referenceNo || opts.date) {
    y -= 20;
    if (opts.referenceNo) {
      page.drawText(`Ref: ${opts.referenceNo}`, { x: M.left, y, size: 9, font, color: MUTED });
    }
    if (opts.date) {
      drawRight(page, font, `Date: ${opts.date}`, M.right, y, 9, MUTED);
    }
  }

  return y - 26;
}

/** Signature block plus the system-generated note, pinned above the bottom margin. */
export function drawSignature(
  page: PDFPage,
  chrome: LetterChrome,
  y: number,
  opts: { companyName: string; note?: string },
): void {
  const { font, bold } = chrome;
  // Keep the block on the page even when the body runs long.
  const blockY = Math.max(y, M.bottom + 96);

  page.drawText(`For ${opts.companyName}`, { x: M.left, y: blockY, size: 10, font: bold, color: INK });
  page.drawLine({
    start: { x: M.left, y: blockY - 46 },
    end: { x: M.left + 170, y: blockY - 46 },
    thickness: 0.6,
    color: RULE,
  });
  page.drawText('Authorised Signatory', { x: M.left, y: blockY - 58, size: 9, font, color: MUTED });

  page.drawLine({
    start: { x: M.left, y: M.bottom + 16 },
    end: { x: M.right, y: M.bottom + 16 },
    thickness: 0.4,
    color: RULE,
  });
  const note = opts.note ?? 'This is a computer-generated document issued by the HR department.';
  page.drawText(note, { x: M.left, y: M.bottom + 4, size: 7.5, font, color: MUTED });
}
