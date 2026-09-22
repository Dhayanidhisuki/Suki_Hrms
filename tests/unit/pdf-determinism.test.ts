/**
 * Every PDF that feeds the Document Module must render byte-identically from
 * identical data.
 *
 * indexGeneratedPdf() de-duplicates generated files on their sha256. pdf-lib
 * stamps the current time into CreationDate/ModDate on save, so without
 * stampDeterministicMetadata() each re-render produces a new hash and files a
 * duplicate version of an unchanged document. These tests render twice across
 * a second boundary — the granularity of a PDF date stamp — and compare.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { stampDeterministicMetadata } from '@/lib/pdf-metadata';
import { generateConfirmationLetterPdf } from '@/lib/confirmation-letter';
import { generateLetterPdf } from '@/lib/letters/generate-letter';
import { generatePayslipPdf, type PayslipData } from '@/lib/payroll/payslip-pdf';

const sha = (b: Uint8Array) => createHash('sha256').update(Buffer.from(b)).digest('hex');
/** PDF dates are second-granular, so a re-render must cross a second to be meaningful. */
const tick = () => new Promise((r) => setTimeout(r, 1100));

const payslip: PayslipData = {
  companyId: 1,
  companyName: 'Test Co',
  companyAddress: 'Plot No. 22 & 23, Ambattur Industrial Estate, Chennai, Tamil Nadu - 600058',
  companyPhone: null,
  companyEmail: null,
  employeeId: 1,
  employeeCode: 'EMP001',
  employeeName: 'Test Employee',
  designation: 'Engineer',
  department: 'IT',
  month: 6,
  year: 2026,
  totalWorkingDays: 26,
  payableDays: 26,
  lopDays: 0,
  earnings: [{ name: 'Basic', amount: 30000 }, { name: 'HRA', amount: 12000 }],
  deductions: [{ name: 'PF', amount: 1800 }],
  grossEarnings: 42000,
  totalDeductions: 1800,
  netSalary: 40200,
};

describe('generated PDFs are reproducible', () => {
  it('payslip renders identically twice', async () => {
    const a = await generatePayslipPdf(payslip);
    await tick();
    const b = await generatePayslipPdf(payslip);
    expect(sha(a)).toBe(sha(b));
  }, 30000);

  it('confirmation letter renders identically twice', async () => {
    const data = {
      companyName: 'Test Co',
      employeeName: 'Test Employee',
      employeeCode: 'EMP001',
      designation: 'Engineer',
      department: 'IT',
      joinDate: new Date('2025-01-01'),
      confirmationDate: new Date('2025-07-01'),
    };
    const a = await generateConfirmationLetterPdf(data);
    await tick();
    const b = await generateConfirmationLetterPdf(data);
    expect(sha(a)).toBe(sha(b));
  }, 30000);

  it('generic letter renders identically twice', async () => {
    const fields = {
      companyName: 'Test Co',
      personName: 'Test Employee',
      employeeCode: 'EMP001',
      effectiveDate: new Date('2026-04-01'),
    };
    const a = await generateLetterPdf('Service Letter', 'SL/2026/0001', fields);
    await tick();
    const b = await generateLetterPdf('Service Letter', 'SL/2026/0001', fields);
    expect(sha(a)).toBe(sha(b));
  }, 30000);

  it('different data still produces different bytes', async () => {
    const a = await generatePayslipPdf(payslip);
    const b = await generatePayslipPdf({ ...payslip, netSalary: 999 });
    expect(sha(a)).not.toBe(sha(b));
  }, 30000);
});

describe('stampDeterministicMetadata', () => {
  it('falls back to a fixed anchor when the document has no date', async () => {
    const mk = async (anchor: Date | null) => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      stampDeterministicMetadata(doc, { anchor, title: 'x' });
      return sha(await doc.save());
    };
    expect(await mk(null)).toBe(await mk(null));
  }, 30000);

  it('ignores an invalid date rather than emitting a broken timestamp', async () => {
    const mk = async () => {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      stampDeterministicMetadata(doc, { anchor: new Date('nonsense'), title: 'x' });
      return sha(await doc.save());
    };
    const first = await mk();
    await tick();
    expect(await mk()).toBe(first);
  }, 30000);
});
