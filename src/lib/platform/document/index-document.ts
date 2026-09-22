/**
 * Index a generated/uploaded file into the Document Module (same store as
 * manual HR/employee uploads). Producers (confirmation, later payslip/F&F)
 * call this instead of writing their own document tables.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '../contracts';
import { uploadDocument, type PlatformDocumentView } from './service';

export async function indexDocument(input: Parameters<typeof uploadDocument>[0]): Promise<PlatformDocumentView> {
  return uploadDocument(input);
}

export async function ensureDocumentType(
  companyId: number,
  code: string,
  defaults: {
    name: string;
    category: string;
    businessCategory: string;
    uploadMode: string;
    appliesToEntity: string;
    documentClass?: string;
    verificationRequired?: boolean;
    allowedFileTypes?: string;
    maxFileSizeMb?: number;
  },
): Promise<void> {
  const existing = await prisma.platformDocumentType.findFirst({ where: { companyId, code } });
  if (existing) return;
  await prisma.platformDocumentType.create({
    data: {
      companyId,
      code,
      name: defaults.name,
      category: defaults.category,
      businessCategory: defaults.businessCategory,
      uploadMode: defaults.uploadMode,
      appliesToEntity: defaults.appliesToEntity,
      documentClass: defaults.documentClass ?? 'CONFIDENTIAL',
      verificationRequired: defaults.verificationRequired ?? false,
      verifierRole: null,
      allowedFileTypes: defaults.allowedFileTypes ?? 'pdf',
      maxFileSizeMb: defaults.maxFileSizeMb ?? 10,
      maxFileCount: 1,
      mandatoryFlag: false,
      isActive: true,
    },
  });
}

/** Skip a new version when the exact same bytes are already stored for this owner+type. */
export async function indexGeneratedPdf(input: {
  companyId: number;
  documentTypeCode: string;
  ownerEntityId: number;
  ownerEntityType?: string;
  fileName: string;
  bytes: Buffer;
  actor: PlatformActor;
}): Promise<PlatformDocumentView | null> {
  const ownerEntityType = (input.ownerEntityType ?? 'EMPLOYEE').toUpperCase();
  const type = await prisma.platformDocumentType.findFirst({
    where: { companyId: input.companyId, code: input.documentTypeCode, isActive: true },
    select: { id: true },
  });
  if (type) {
    const sha256Hash = createHash('sha256').update(input.bytes).digest('hex');
    const dup = await prisma.platformDocument.findFirst({
      where: {
        companyId: input.companyId,
        documentTypeId: type.id,
        ownerEntityType,
        ownerEntityId: input.ownerEntityId,
        sha256Hash,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (dup) return null;
  }
  return indexDocument({
    companyId: input.companyId,
    documentTypeCode: input.documentTypeCode,
    ownerEntityType,
    ownerEntityId: input.ownerEntityId,
    file: { name: input.fileName, mimeType: 'application/pdf', bytes: input.bytes },
    actor: input.actor,
  });
}

/** After join, candidate files stay in the same store under the employee. */
export async function transferCandidateDocumentsToEmployee(
  companyId: number,
  applicantId: number,
  employeeId: number,
): Promise<number> {
  const result = await prisma.platformDocument.updateMany({
    where: {
      companyId,
      ownerEntityType: 'CANDIDATE',
      ownerEntityId: applicantId,
      deletedAt: null,
    },
    data: {
      ownerEntityType: 'EMPLOYEE',
      ownerEntityId: employeeId,
    },
  });
  return result.count;
}
