/**
 * PDF generation for Visitor module.
 * Two pass types:
 *   1. Visitor pass — visitor badge with QR, host, validity, etc.
 *   2. Gate pass — full detail security copy.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { VisitorGatePass, Employee, Company } from '@prisma/client';

type PassWithIncludes = VisitorGatePass & {
  company: Pick<Company, 'name'>;
  personToMeet: Pick<Employee, 'firstName' | 'lastName' | 'employeeCode' | 'oldEmployeeCode'>;
};

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function embedQrPng(doc: PDFDocument, token: string, size: number): Promise<import('pdf-lib').PDFImage> {
  const dataUrl = await QRCode.toDataURL(token, { width: size, margin: 2 });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const png = Buffer.from(base64, 'base64');
  return doc.embedPng(png);
}

export async function generateVisitorPassPdf(pass: PassWithIncludes): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 595]); // A5-ish badge
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.12, 0.62, 0.38); // project green-ish

  let y = 560;
  const margin = 30;
  const line = 18;

  const write = (text: string, opts?: { size?: number; bold?: boolean }) => {
    page.drawText(text, {
      x: margin,
      y,
      size: opts?.size ?? 11,
      font: opts?.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= opts?.size ? opts.size + 4 : line;
  };

  write(pass.company?.name ?? 'Suki HRMS', { size: 14, bold: true });
  y -= 10;
  write('VISITOR PASS', { size: 18, bold: true });
  y -= 15;

  write(`Name: ${pass.visitorName}`, { bold: true });
  write(`Mobile: ${pass.mobilePrefix} ${pass.mobileNo}`);
  write(`Type: ${pass.visitorTypeValue ?? '—'}`);
  write(`Purpose: ${pass.purposeValue ?? '—'}`);
  write(`To Meet: ${pass.personToMeet?.firstName ?? ''} ${pass.personToMeet?.lastName ?? ''}`);
  write(`Pass No: ${pass.gatePassNo}`);
  write(`Valid From: ${formatDateTime(pass.validFrom)}`);
  write(`Valid To:   ${formatDateTime(pass.validTo)}`);
  y -= 10;

  write(`No. of Persons: ${pass.noOfPersons}`);
  write(`Food Required: ${pass.foodRequired ? 'YES' : 'NO'}`);
  write(`Food Category: ${pass.foodCategory ?? '—'}`);
  write(`Food Type: ${pass.foodType ?? '—'}`);
  write(`Gadgets: ${pass.gadgets ?? '—'}`);
  y -= 10;

  const qrImg = await embedQrPng(doc, pass.qrToken, 180);
  page.drawImage(qrImg, { x: margin, y: y - 120, width: 120, height: 120 });
  y -= 140;

  write(`QR Token: ${pass.qrToken}`, { size: 8 });

  return doc.save();
}

export async function generateGatePassPdf(pass: PassWithIncludes): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  const margin = 50;
  const line = 20;

  const write = (text: string, opts?: { size?: number; bold?: boolean }) => {
    page.drawText(text, {
      x: margin,
      y,
      size: opts?.size ?? 11,
      font: opts?.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= opts?.size ? opts.size + 6 : line;
  };

  write(pass.company?.name ?? 'Suki HRMS', { size: 16, bold: true });
  write('GATE PASS', { size: 14, bold: true });
  y -= 10;

  write(`Gate Pass No: ${pass.gatePassNo}`, { bold: true });
  write(`Pass Type: ${pass.passType === 'GATE_PASS' ? 'GATE PASS' : 'WORK PERMIT'}`);
  write(`Status: ${pass.status}`);
  write(`Date: ${formatDate(pass.visitDate)}`);
  write(`Valid From: ${formatDateTime(pass.validFrom)}`);
  write(`Valid To:   ${formatDateTime(pass.validTo)}`);
  y -= 5;

  write('VISITOR DETAILS', { bold: true });
  write(`Name: ${pass.visitorName}`);
  write(`Mobile: ${pass.mobilePrefix} ${pass.mobileNo}`);
  write(`Visitor Type: ${pass.visitorTypeValue ?? '—'}`);
  write(`Party: ${pass.partyName ?? '—'}`);
  write(`Email: ${pass.email ?? '—'}`);
  write(`Address: ${pass.address ?? '—'}`);
  write(`Purpose: ${pass.purposeValue ?? '—'}`);
  y -= 5;

  write('HOST & LOGISTICS', { bold: true });
  write(`Person To Meet: ${pass.personToMeet?.firstName ?? ''} ${pass.personToMeet?.lastName ?? ''}` +
        ` (${pass.personToMeet?.oldEmployeeCode ?? ''})`);
  write(`No. of Persons: ${pass.noOfPersons}`);
  write(`Planned In: ${pass.plannedInTime ?? '—'}`);
  write(`Planned Out: ${pass.plannedOutTime ?? '—'}`);
  write(`Food Required: ${pass.foodRequired ? 'YES' : 'NO'}`);
  write(`Food Category: ${pass.foodCategory ?? '—'}`);
  write(`Food Type: ${pass.foodType ?? '—'}`);
  write(`Gadgets: ${pass.gadgets ?? '—'}`);
  y -= 5;

  write('GATE MOVEMENT', { bold: true });
  write(`Check-In:  ${formatDateTime(pass.checkInTime)}`);
  write(`Check-Out: ${formatDateTime(pass.checkOutTime)}`);
  y -= 10;

  const qrImg = await embedQrPng(doc, pass.qrToken, 160);
  page.drawImage(qrImg, { x: margin, y: y - 120, width: 100, height: 100 });

  return doc.save();
}
