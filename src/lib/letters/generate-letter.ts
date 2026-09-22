/**
 * HR letter PDF + register. Templates follow KUN Forms/*.docx field sets.
 * Bytes are indexed into PlatformDocument (same store as the Document Module).
 */

import { PDFDocument } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '@/lib/platform/contracts';
import { ensureDocumentType, indexGeneratedPdf } from '@/lib/platform/document/index-document';
import { stampDeterministicMetadata } from '@/lib/pdf-metadata';
import { loadCompanyProfile } from '@/lib/company-profile';
import {
  INK,
  M,
  PAGE,
  drawLetterhead,
  drawSignature,
  prepareChrome,
  wrapToWidth,
} from '@/lib/letter-template';

export const LETTER_TYPES = [
  'OFFER_LETTER',
  'APPOINTMENT_LETTER',
  'WARNING_LETTER',
  'SHOW_CAUSE',
  'SERVICE_LETTER',
  'BONAFIDE',
  'COMPANY_RELIEVING',
] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

const SPECS: Record<LetterType, { title: string; prefix: string; owner: 'EMPLOYEE' | 'CANDIDATE'; category: string; businessCategory: string }> = {
  OFFER_LETTER: { title: 'OFFER LETTER', prefix: 'HRM/OFL', owner: 'CANDIDATE', category: 'EMPLOYMENT', businessCategory: 'RECRUITMENT' },
  APPOINTMENT_LETTER: { title: 'APPOINTMENT ORDER', prefix: 'KAPLHR/Appt', owner: 'EMPLOYEE', category: 'EMPLOYMENT', businessCategory: 'RECRUITMENT' },
  WARNING_LETTER: { title: 'WARNING LETTER', prefix: 'KAPLHR/Warn', owner: 'EMPLOYEE', category: 'EMPLOYMENT', businessCategory: 'LETTERS_CERTIFICATES' },
  SHOW_CAUSE: { title: 'SHOW CAUSE NOTICE', prefix: 'KAPLHR/SCN', owner: 'EMPLOYEE', category: 'EMPLOYMENT', businessCategory: 'LETTERS_CERTIFICATES' },
  SERVICE_LETTER: { title: 'SERVICE CERTIFICATE', prefix: 'KAPLHR/SL', owner: 'EMPLOYEE', category: 'EMPLOYMENT', businessCategory: 'LETTERS_CERTIFICATES' },
  BONAFIDE: { title: 'BONAFIDE CERTIFICATE', prefix: 'KAPLHR/BC', owner: 'EMPLOYEE', category: 'EMPLOYMENT', businessCategory: 'LETTERS_CERTIFICATES' },
  COMPANY_RELIEVING: { title: 'RELIEVING LETTER', prefix: 'KAPLHR/RL', owner: 'EMPLOYEE', category: 'EXIT', businessCategory: 'LETTERS_CERTIFICATES' },
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export type LetterFields = {
  companyName: string;
  /** From the Company record via loadCompanyProfile(); blank prints no address line. */
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  personName: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  joinDate?: Date;
  effectiveDate?: Date;
  lastWorkingDay?: Date;
  ctcText?: string;
  purpose?: string;
  misconduct?: string;
  absencePeriod?: string;
  explanationDeadline?: Date;
  extraLines?: string[];
};

export async function allocateLetterRef(companyId: number, letterType: LetterType, year: number): Promise<string> {
  const spec = SPECS[letterType];
  const seq = await prisma.letterNumberSequence.upsert({
    where: { companyId_letterType_year: { companyId, letterType, year } },
    create: { companyId, letterType, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${spec.prefix}/${year}/${String(seq.lastNumber).padStart(4, '0')}`;
}

export async function generateLetterPdf(
  title: string,
  referenceNo: string,
  fields: LetterFields,
  letterType?: LetterType,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Anchored to the letter's own effective/join date so re-issuing the same
  // letter reproduces identical bytes (see pdf-metadata.ts).
  stampDeterministicMetadata(doc, {
    anchor: fields.effectiveDate ?? fields.joinDate ?? null,
    title: `${title} — ${referenceNo}`,
  });
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const chrome = await prepareChrome(doc);
  const bodyWidth = M.right - M.left;

  let y = drawLetterhead(page, chrome, {
    companyName: fields.companyName,
    companyAddress: fields.companyAddress,
    companyPhone: fields.companyPhone,
    companyEmail: fields.companyEmail,
    title,
    referenceNo,
    date: formatDate(fields.effectiveDate ?? new Date()),
  });

  page.drawText(`Dear ${fields.personName},`, { x: M.left, y, size: 11, font: chrome.font, color: INK });
  y -= 24;

  for (const line of letterBody(title, fields, letterType)) {
    if (!line) {
      y -= 10;
      continue;
    }
    for (const wrapped of wrapToWidth(chrome.font, line, 11, bodyWidth)) {
      page.drawText(wrapped, { x: M.left, y, size: 11, font: chrome.font, color: INK });
      y -= 16;
    }
    y -= 6;
  }

  drawSignature(page, chrome, y - 24, { companyName: fields.companyName });
  return doc.save();
}

/**
 * Body text for a letter.
 *
 * Prefer `letterType`: matching on the display title is case-sensitive and
 * falls through to the relieving-letter text for anything unrecognised, so a
 * caller passing "Service Letter" instead of "SERVICE CERTIFICATE" would
 * silently issue the wrong letter. The title match is kept only as a fallback
 * for callers that have no type to hand.
 */
export function letterBody(title: string, f: LetterFields, letterType?: LetterType): string[] {
  const desig = f.designation ?? 'the stated designation';
  const dept = f.department ?? 'the stated department';
  const is = (type: LetterType, titleNeedle: string) =>
    letterType ? letterType === type : title.toUpperCase().includes(titleNeedle);

  if (is('OFFER_LETTER', 'OFFER')) {
    return [
      `We are pleased to offer you the position of ${desig} in ${dept}.`,
      f.joinDate ? `Your proposed date of joining is ${formatDate(f.joinDate)}.` : '',
      f.ctcText ? `The compensation offered is ${f.ctcText}.` : '',
      'This offer is subject to document verification and a six-month probation period.',
      'Please sign and return a copy of this letter to confirm acceptance.',
    ];
  }
  if (is('APPOINTMENT_LETTER', 'APPOINTMENT')) {
    return [
      `You are hereby appointed as ${desig} in ${dept} with effect from ${formatDate(f.effectiveDate ?? f.joinDate ?? new Date())}.`,
      f.ctcText ? `Your compensation is ${f.ctcText}.` : '',
      'Probation is six months unless confirmed earlier in writing. Notice during probation is one month; after confirmation, three months.',
      'All other terms are as per company standing orders and HR policy.',
    ];
  }
  if (is('WARNING_LETTER', 'WARNING')) {
    return [
      `This is a warning regarding ${f.misconduct ?? 'the misconduct recorded below'}.`,
      f.absencePeriod ? `Period / dates: ${f.absencePeriod}.` : '',
      'You are required to improve immediately. Further occurrence may lead to disciplinary action including termination.',
    ];
  }
  if (is('SHOW_CAUSE', 'SHOW CAUSE')) {
    return [
      `You are required to explain ${f.misconduct ?? 'the charge stated below'}.`,
      f.absencePeriod ? `Particulars: ${f.absencePeriod}.` : '',
      f.explanationDeadline
        ? `Submit your written explanation on or before ${formatDate(f.explanationDeadline)}, failing which action will be taken as deemed fit.`
        : 'Submit your written explanation without delay.',
    ];
  }
  if (is('SERVICE_LETTER', 'SERVICE')) {
    return [
      `This is to certify that ${f.personName}${f.employeeCode ? ` (Employee Code ${f.employeeCode})` : ''} was employed as ${desig} in ${dept}.`,
      f.joinDate ? `Date of joining: ${formatDate(f.joinDate)}.` : '',
      f.lastWorkingDay ? `Relieved on: ${formatDate(f.lastWorkingDay)}.` : 'The employee is currently in service.',
      'During the tenure, conduct was found satisfactory to the best of our knowledge.',
    ];
  }
  if (is('BONAFIDE', 'BONAFIDE')) {
    return [
      `This is to certify that ${f.personName}${f.employeeCode ? ` (Employee Code ${f.employeeCode})` : ''} is a bona fide employee of ${f.companyName}, working as ${desig} in ${dept}.`,
      f.joinDate ? `Date of joining: ${formatDate(f.joinDate)}.` : '',
      f.purpose ? `This certificate is issued for the purpose of ${f.purpose}.` : 'This certificate is issued at the employee’s request.',
    ];
  }
  return [
    `This is to confirm that ${f.personName}${f.employeeCode ? ` (Employee Code ${f.employeeCode})` : ''} has been relieved from services as ${desig}.`,
    f.lastWorkingDay ? `Last working day: ${formatDate(f.lastWorkingDay)}.` : '',
    'Full and final settlement will be processed as per company policy.',
  ];
}

export async function issueHrLetter(input: {
  companyId: number;
  letterType: LetterType;
  employeeId?: number | null;
  applicantId?: number | null;
  fields: LetterFields;
  actor: PlatformActor;
  purpose?: string | null;
}): Promise<{ id: number; referenceNo: string; platformDocumentId: number | null; pdf: Uint8Array }> {
  const spec = SPECS[input.letterType];
  const year = (input.fields.effectiveDate ?? new Date()).getUTCFullYear();
  const referenceNo = await allocateLetterRef(input.companyId, input.letterType, year);

  // Company identity always comes from the record being issued against, so a
  // caller cannot accidentally print another company's letterhead.
  const profile = await loadCompanyProfile(input.companyId);
  const fields: LetterFields = {
    ...input.fields,
    companyName: profile?.name ?? input.fields.companyName,
    companyAddress: profile?.address ?? input.fields.companyAddress ?? null,
    companyPhone: profile?.phone ?? null,
    companyEmail: profile?.email ?? null,
  };
  const pdf = await generateLetterPdf(spec.title, referenceNo, fields, input.letterType);
  const bytes = Buffer.from(pdf);

  const ownerEntityType = spec.owner;
  const ownerEntityId = ownerEntityType === 'CANDIDATE' ? input.applicantId : input.employeeId;
  if (!ownerEntityId) {
    throw new Error(`${input.letterType} requires a ${ownerEntityType.toLowerCase()} id`);
  }

  await ensureDocumentType(input.companyId, input.letterType, {
    name: spec.title,
    category: spec.category,
    businessCategory: spec.businessCategory,
    uploadMode: 'HR_ONLY',
    appliesToEntity: ownerEntityType,
    documentClass: 'CONFIDENTIAL',
    verificationRequired: false,
    allowedFileTypes: 'pdf',
    maxFileSizeMb: 10,
  });

  const indexed = await indexGeneratedPdf({
    companyId: input.companyId,
    documentTypeCode: input.letterType,
    ownerEntityType,
    ownerEntityId,
    fileName: `${input.letterType}-${referenceNo.replace(/\//g, '-')}.pdf`,
    bytes,
    actor: { ...input.actor, source: 'system' },
  });

  const row = await prisma.generatedHrLetter.create({
    data: {
      companyId: input.companyId,
      letterType: input.letterType,
      referenceNo,
      employeeId: input.employeeId ?? null,
      applicantId: input.applicantId ?? null,
      issuedDate: input.fields.effectiveDate ?? new Date(),
      purpose: input.purpose ?? input.fields.purpose ?? null,
      // Same type-keyed dispatch as the PDF, so the register snapshot can
      // never describe a different letter from the one that was issued.
      bodySnapshot: letterBody(spec.title, fields, input.letterType).filter(Boolean).join('\n'),
      platformDocumentId: indexed?.id ?? null,
      issuedByUserId: input.actor.userId,
    },
  });

  return { id: row.id, referenceNo, platformDocumentId: indexed?.id ?? null, pdf };
}
