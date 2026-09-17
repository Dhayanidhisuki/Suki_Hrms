/**
 * Deterministic PDF metadata.
 *
 * pdf-lib stamps the *current* time into CreationDate and ModDate on save, so
 * rendering the same document twice yields different bytes and a different
 * sha256. The Document Module de-duplicates generated files on that hash
 * (indexGeneratedPdf), so without this every re-render of an unchanged letter,
 * payslip or statement files a brand-new version.
 *
 * Every generator that feeds the Document Module must call this. Anchor the
 * timestamps to something derived from the document's own data — a pay period,
 * an issue date, a settlement date — never to `new Date()`, which would
 * reintroduce the problem.
 */

import type { PDFDocument } from 'pdf-lib';

/** Fallback anchor for documents with no meaningful date of their own. */
const EPOCH = new Date(Date.UTC(2000, 0, 1));

export function stampDeterministicMetadata(
  doc: PDFDocument,
  options: { anchor?: Date | null; title?: string },
): void {
  const anchor = options.anchor && !Number.isNaN(options.anchor.getTime()) ? options.anchor : EPOCH;
  doc.setCreationDate(anchor);
  doc.setModificationDate(anchor);
  doc.setProducer('Suki HRMS');
  doc.setCreator('Suki HRMS');
  if (options.title) doc.setTitle(options.title);
}
