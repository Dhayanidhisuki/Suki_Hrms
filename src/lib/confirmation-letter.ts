/**
 * Generates a simple Confirmation Letter PDF using pdf-lib (pure JS, no
 * native bindings — avoids the cross-platform native-binary pain already
 * hit once in this project with lightningcss).
 */

import { PDFDocument } from 'pdf-lib';
import { stampDeterministicMetadata } from '@/lib/pdf-metadata';
import { INK, M, PAGE, drawLetterhead, drawSignature, prepareChrome, wrapToWidth } from '@/lib/letter-template';
import { loadCompanyProfile } from '@/lib/company-profile';

export interface ConfirmationLetterData {
  companyName: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  joinDate: Date;
  confirmationDate: Date;
  /** From the Company record via loadCompanyProfile(). */
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  /** Optional register reference, shown on the letterhead when present. */
  referenceNo?: string | null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function generateConfirmationLetterPdf(data: ConfirmationLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  stampDeterministicMetadata(doc, {
    anchor: data.confirmationDate,
    title: `Confirmation letter — ${data.employeeCode}`,
  });
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const chrome = await prepareChrome(doc);
  const bodyWidth = M.right - M.left;

  let y = drawLetterhead(page, chrome, {
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    companyPhone: data.companyPhone,
    companyEmail: data.companyEmail,
    title: 'Confirmation Letter',
    referenceNo: data.referenceNo ?? null,
    date: formatDate(data.confirmationDate),
  });

  page.drawText(`Dear ${data.employeeName},`, { x: M.left, y, size: 11, font: chrome.font, color: INK });
  y -= 24;

  // Paragraphs, not pre-broken lines — wrapToWidth measures the real glyph
  // widths, so the right edge stays even whatever the name or designation.
  const paragraphs = [
    `This is to confirm that your employment with ${data.companyName}, which began on ${formatDate(data.joinDate)} as ${data.designation} in the ${data.department} department (Employee Code: ${data.employeeCode}), has been reviewed following the completion of your probation period.`,
    `We are pleased to confirm your appointment as a permanent employee with effect from ${formatDate(data.confirmationDate)}. All other terms and conditions of your employment remain unchanged.`,
    'We look forward to your continued contribution.',
  ];
  for (const para of paragraphs) {
    for (const line of wrapToWidth(chrome.font, para, 11, bodyWidth)) {
      page.drawText(line, { x: M.left, y, size: 11, font: chrome.font, color: INK });
      y -= 16;
    }
    y -= 10;
  }

  drawSignature(page, chrome, y - 24, { companyName: data.companyName });
  return doc.save();
}

export async function archiveConfirmationLetter(employeeId: number, actor: import('@/lib/platform/contracts').PlatformActor): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  const { ensureDocumentType, indexGeneratedPdf } = await import('@/lib/platform/document/index-document');

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    include: {
      company: { select: { name: true } },
      jobInfos: {
        where: { effectiveTo: null },
        take: 1,
        include: { designation: { select: { name: true } }, department: { select: { name: true } } },
      },
    },
  });
  const job = employee?.jobInfos[0];
  if (!employee || !job?.confirmationDate) return;

  await ensureDocumentType(employee.companyId, 'CONFIRMATION_LETTER', {
    name: 'Confirmation letter',
    category: 'EMPLOYMENT',
    businessCategory: 'LIFECYCLE',
    uploadMode: 'HR_ONLY',
    appliesToEntity: 'EMPLOYEE',
    documentClass: 'CONFIDENTIAL',
    verificationRequired: false,
    allowedFileTypes: 'pdf',
    maxFileSizeMb: 10,
  });

  const displayCode = employee.oldEmployeeCode ?? '';
  const profile = await loadCompanyProfile(employee.companyId);
  const pdfBytes = await generateConfirmationLetterPdf({
    companyName: profile?.name ?? employee.company.name,
    companyAddress: profile?.address ?? null,
    companyPhone: profile?.phone ?? null,
    companyEmail: profile?.email ?? null,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeCode: displayCode,
    designation: job.designation.name,
    department: job.department.name,
    joinDate: job.joinDate,
    confirmationDate: job.confirmationDate,
  });

  try {
    await indexGeneratedPdf({
      companyId: employee.companyId,
      documentTypeCode: 'CONFIRMATION_LETTER',
      ownerEntityId: employee.id,
      fileName: `confirmation-letter-${displayCode}.pdf`,
      bytes: Buffer.from(pdfBytes),
      actor: { ...actor, source: 'system' },
    });
  } catch (err) {
    console.error('[confirmation-letter] document index failed', err);
  }
}
