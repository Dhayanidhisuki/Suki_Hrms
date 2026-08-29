/**
 * Generates a simple Confirmation Letter PDF using pdf-lib (pure JS, no
 * native bindings — avoids the cross-platform native-binary pain already
 * hit once in this project with lightningcss).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ConfirmationLetterData {
  companyName: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  joinDate: Date;
  confirmationDate: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function generateConfirmationLetterPdf(data: ConfirmationLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 60;
  let y = 780;
  const lineHeight = 20;

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    page.drawText(text, {
      x: margin,
      y,
      size: opts?.size ?? 11,
      font: opts?.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= opts?.gap ?? lineHeight;
  };

  drawLine(data.companyName, { bold: true, size: 16, gap: 30 });
  drawLine('CONFIRMATION LETTER', { bold: true, size: 14, gap: 30 });

  drawLine(`Date: ${formatDate(data.confirmationDate)}`, { gap: 30 });

  drawLine(`Dear ${data.employeeName},`, { gap: 24 });

  const bodyLines = [
    `This is to confirm that your employment with ${data.companyName}, which began on`,
    `${formatDate(data.joinDate)} as ${data.designation} in the ${data.department} department`,
    `(Employee Code: ${data.employeeCode}), has been reviewed following the completion of your`,
    `probation period.`,
    '',
    `We are pleased to confirm your appointment as a permanent employee with effect from`,
    `${formatDate(data.confirmationDate)}. All other terms and conditions of your employment remain`,
    `unchanged.`,
    '',
    'We look forward to your continued contribution.',
  ];
  for (const line of bodyLines) {
    drawLine(line, { gap: line === '' ? 14 : 18 });
  }

  y -= 30;
  drawLine('For ' + data.companyName, { gap: 50 });
  drawLine('Authorized Signatory', {});

  return doc.save();
}
