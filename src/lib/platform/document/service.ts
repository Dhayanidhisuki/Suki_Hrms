/**
 * Document Management service (BRD Part C, §15–18).
 *
 * One PlatformDocument row is one stored file; bytes live under
 * uploads/ via src/lib/file-storage.ts and only the storageKey is kept in
 * SQL. Every state change is audited (entityType 'PlatformDocument') and
 * raised as a platform event; the notification service subscribes.
 *
 * Implemented here: upload validation §15.4 steps 1–5, 7, 9, 10 (resolution
 * and virus scanning are extension points — see scanFile()), the §16.1
 * state machine, §16.3 versioning/supersession, §16.4 completeness, §17.1
 * expiry, and a simplified §17.3 access check (canAccessDocument).
 */

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { saveUploadedFile, readStoredFile } from '@/lib/file-storage';
import type { PlatformActor } from '../contracts';
import { emitPlatformEvent } from '../events';
import { audit } from '../audit/service';
import {
  ACTIVE_STATUSES,
  DOC_STATUS,
  DocumentError,
  HR_MANAGER_ROLE_CODES,
  PENDING_STATUSES,
  REJECTION_REASON_CODES,
  assertTransition,
  computeCompleteness,
  daysUntil,
  extensionOf,
  financialYearCode,
  formatDocumentRef,
  isExtensionAllowed,
  isSizeWithinLimit,
  isValidPan,
  istToday,
  magicMatchesExtension,
  maskIdentifier,
  mimeTypeForExtension,
  parseAlertOffsets,
  sanitizeFileName,
  serialFromDocumentRef,
  type DocStatus,
  type RejectionReasonCode,
} from './rules';

export { DocumentError, REJECTION_REASON_CODES } from './rules';
export type { RejectionReasonCode, DocStatus } from './rules';

type DocumentRow = Prisma.PlatformDocumentGetPayload<Record<string, never>>;
type DocumentTypeRow = Prisma.PlatformDocumentTypeGetPayload<Record<string, never>>;

const ENTITY_TYPE = 'PlatformDocument';
const REF_ALLOC_RETRIES = 5;

export type PlatformDocumentView = {
  id: number;
  companyId: number;
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeName: string;
  documentClass: string;
  category: string;
  ownerEntityType: string;
  ownerEntityId: number;
  documentRef: string;
  versionNo: number;
  supersedesDocumentId: number | null;
  supersededByDocumentId: number | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  identifierMasked: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  verifiedByUserId: number | null;
  verifiedAt: Date | null;
  verificationRemark: string | null;
  rejectionReasonCode: string | null;
  scanStatus: string;
  uploadedByUserId: number | null;
  uploadedAt: Date;
  /** Another document of the same owner+type with identical bytes (§15.4 step 7 warning). */
  duplicateOf: number | null;
};

export type UploadDocumentInput = {
  companyId: number;
  documentTypeCode: string;
  ownerEntityType: string;
  ownerEntityId: number;
  file: { name: string; mimeType: string; bytes: Buffer };
  issueDate?: Date;
  expiryDate?: Date;
  identifier?: string;
  actor: PlatformActor;
};

// ---------------------------------------------------------------- helpers

function dateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toView(doc: DocumentRow, type: Pick<DocumentTypeRow, 'code' | 'name' | 'documentClass' | 'category'>, duplicateOf: number | null = null): PlatformDocumentView {
  return {
    id: doc.id,
    companyId: doc.companyId,
    documentTypeId: doc.documentTypeId,
    documentTypeCode: type.code,
    documentTypeName: type.name,
    documentClass: type.documentClass,
    category: type.category,
    ownerEntityType: doc.ownerEntityType,
    ownerEntityId: doc.ownerEntityId,
    documentRef: doc.documentRef,
    versionNo: doc.versionNo,
    supersedesDocumentId: doc.supersedesDocumentId,
    supersededByDocumentId: doc.supersededByDocumentId,
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSizeBytes: Number(doc.fileSizeBytes),
    sha256Hash: doc.sha256Hash,
    identifierMasked: doc.identifierMasked,
    issueDate: dateOnly(doc.issueDate),
    expiryDate: dateOnly(doc.expiryDate),
    verificationStatus: doc.verificationStatus,
    verifiedByUserId: doc.verifiedByUserId,
    verifiedAt: doc.verifiedAt,
    verificationRemark: doc.verificationRemark,
    rejectionReasonCode: doc.rejectionReasonCode,
    scanStatus: doc.scanStatus,
    uploadedByUserId: doc.uploadedByUserId,
    uploadedAt: doc.uploadedAt,
    duplicateOf,
  };
}

/** Audit snapshot: the fields that matter for "what changed", never the storage key. */
function auditShape(doc: DocumentRow) {
  return {
    documentRef: doc.documentRef,
    versionNo: doc.versionNo,
    verificationStatus: doc.verificationStatus,
    verifiedByUserId: doc.verifiedByUserId,
    verificationRemark: doc.verificationRemark,
    rejectionReasonCode: doc.rejectionReasonCode,
    supersededByDocumentId: doc.supersededByDocumentId,
    sha256Hash: doc.sha256Hash,
    fileSizeBytes: Number(doc.fileSizeBytes),
  };
}

async function loadDocument(companyId: number, documentId: number): Promise<{ doc: DocumentRow; type: DocumentTypeRow }> {
  // An undefined id would match any row in findFirst — never let that through.
  if (!Number.isInteger(documentId) || documentId <= 0 || !Number.isInteger(companyId)) throw new DocumentError(404, 'Document not found');
  const doc = await prisma.platformDocument.findFirst({ where: { id: documentId, companyId, deletedAt: null } });
  if (!doc) throw new DocumentError(404, 'Document not found');
  const type = await prisma.platformDocumentType.findFirst({ where: { id: doc.documentTypeId, companyId } });
  if (!type) throw new DocumentError(404, 'Document type not found');
  return { doc, type };
}

async function findDuplicate(doc: Pick<DocumentRow, 'id' | 'companyId' | 'documentTypeId' | 'ownerEntityType' | 'ownerEntityId' | 'sha256Hash'>): Promise<number | null> {
  const dup = await prisma.platformDocument.findFirst({
    where: {
      companyId: doc.companyId,
      documentTypeId: doc.documentTypeId,
      ownerEntityType: doc.ownerEntityType,
      ownerEntityId: doc.ownerEntityId,
      sha256Hash: doc.sha256Hash,
      deletedAt: null,
      id: { not: doc.id },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return dup?.id ?? null;
}

async function roleCodeOf(userId: number | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { code: true } } } });
  return user?.role?.code ?? null;
}

/** Deep link the notification templates render as {{Link.RequestDetail}}. */
function documentLinkPath(doc: Pick<DocumentRow, 'id' | 'ownerEntityType' | 'ownerEntityId'>): string {
  return doc.ownerEntityType === 'EMPLOYEE'
    ? `/employees/${doc.ownerEntityId}?tab=documents`
    : `/admin/platform/documents/${doc.id}`;
}

function eventContext(doc: DocumentRow, type: DocumentTypeRow, extra?: { RejectionReason?: string | null }) {
  return {
    moduleCode: 'PLAT' as const,
    sourceEntityType: ENTITY_TYPE,
    sourceEntityId: doc.id,
    linkPath: documentLinkPath(doc),
    ...(doc.ownerEntityType === 'EMPLOYEE' ? { subjectEmpId: doc.ownerEntityId } : {}),
    data: {
      Document: {
        TypeName: type.name,
        TypeCode: type.code,
        Ref: doc.documentRef,
        Status: doc.verificationStatus,
        RejectionReason: extra?.RejectionReason ?? null,
      },
    },
  };
}

/**
 * EXTENSION POINT — §17.6 virus scanning. This iteration does not scan;
 * every upload is persisted with scanStatus 'Skipped'. Replace the body
 * with an ICAP call returning 'Clean' | 'Infected' | 'Failed' and the
 * upload will hold the file until 'Clean' (see uploadDocument step 8).
 */
export async function scanFile(_bytes: Buffer): Promise<'Skipped' | 'Clean' | 'Infected' | 'Failed'> {
  void _bytes;
  return 'Skipped';
}

/**
 * Allocate the next DOC/<FY>/<serial> for the company inside `tx`.
 * Serial is per company per financial year; the (companyId, documentRef)
 * unique index is the guard, and the caller retries on a collision.
 */
async function nextDocumentRef(tx: Prisma.TransactionClient, companyId: number, now: Date): Promise<string> {
  const fy = financialYearCode(now);
  const prefix = `DOC/${fy}/`;
  const last = await tx.platformDocument.findFirst({
    where: { companyId, documentRef: { startsWith: prefix } },
    orderBy: { documentRef: 'desc' },
    select: { documentRef: true },
  });
  return formatDocumentRef(fy, serialFromDocumentRef(last?.documentRef) + 1);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// ---------------------------------------------------------------- upload

export async function uploadDocument(input: UploadDocumentInput): Promise<PlatformDocumentView> {
  const { companyId, actor } = input;
  const ownerEntityType = input.ownerEntityType.toUpperCase();
  const ownerEntityId = Number(input.ownerEntityId);
  if (!Number.isInteger(ownerEntityId) || ownerEntityId <= 0) throw new DocumentError(400, 'ownerEntityId is invalid');

  const type = await prisma.platformDocumentType.findFirst({
    where: { companyId, code: input.documentTypeCode.toUpperCase(), isActive: true },
  });
  if (!type) throw new DocumentError(404, 'Document type not found');

  // Step 1 — authorise: the type must apply to this owner entity, and an
  // EMPLOYEE owner must exist in this company (cross-tenant → 404).
  if (type.appliesToEntity !== ownerEntityType) {
    throw new DocumentError(400, `Document type ${type.code} applies to ${type.appliesToEntity}, not ${ownerEntityType}`);
  }
  if (ownerEntityType === 'EMPLOYEE') {
    const owner = await prisma.employee.findFirst({ where: { id: ownerEntityId, companyId, deletedAt: null }, select: { id: true } });
    if (!owner) throw new DocumentError(404, 'Owner employee not found');
  }

  // Step 2 — extension.
  const ext = extensionOf(input.file.name);
  if (!ext || !isExtensionAllowed(ext, type.allowedFileTypes)) {
    throw new DocumentError(400, `File type .${ext || '?'} is not allowed for ${type.code} (allowed: ${type.allowedFileTypes})`);
  }
  // Step 3 — magic bytes must match the declared extension.
  if (!magicMatchesExtension(input.file.bytes, ext)) {
    throw new DocumentError(400, `File content does not match its .${ext} extension`);
  }
  // Step 4 — size.
  if (!isSizeWithinLimit(input.file.bytes.length, type.maxFileSizeMb)) {
    throw new DocumentError(400, `File exceeds the ${type.maxFileSizeMb} MB limit for ${type.code} (or is empty)`);
  }

  // Type-level data rules.
  if (type.expiryRequired && !input.expiryDate) {
    throw new DocumentError(400, `${type.code} requires an expiry date`);
  }
  if (input.issueDate && input.expiryDate && input.expiryDate.getTime() < input.issueDate.getTime()) {
    throw new DocumentError(400, 'expiryDate must not be before issueDate');
  }
  if (type.code === 'PAN' && input.identifier && !isValidPan(input.identifier)) {
    throw new DocumentError(400, 'PAN must be five letters, four digits and one letter, with P as the fourth character');
  }

  // Step 5 — active file count. A Verified head that this upload will
  // supersede does not occupy a slot; in-flight versions do.
  const existing = await prisma.platformDocument.findMany({
    where: { companyId, documentTypeId: type.id, ownerEntityType, ownerEntityId, deletedAt: null },
    orderBy: [{ versionNo: 'desc' }, { id: 'desc' }],
    select: { id: true, versionNo: true, verificationStatus: true },
  });
  const active = existing.filter((d) => (ACTIVE_STATUSES as readonly string[]).includes(d.verificationStatus));
  const currentVerified = active.find((d) => d.verificationStatus === DOC_STATUS.Verified) ?? null;
  const occupied = active.length - (currentVerified ? 1 : 0);
  if (occupied >= type.maxFileCount) {
    throw new DocumentError(400, `${type.code} already has ${occupied} active file(s); maximum is ${type.maxFileCount}`);
  }
  const versionNo = (existing[0]?.versionNo ?? 0) + 1;

  // Step 7 — hash. Duplicates within owner+type are allowed but reported.
  const sha256Hash = createHash('sha256').update(input.file.bytes).digest('hex');

  // Step 8 — virus scan (extension point; Skipped in this iteration).
  const scanStatus = await scanFile(input.file.bytes);
  if (scanStatus === 'Infected' || scanStatus === 'Failed') {
    throw new DocumentError(400, 'File was rejected by security scanning');
  }

  // Step 10 — initial state.
  const verificationRequired = type.verificationRequired;
  const initialStatus: DocStatus = verificationRequired ? DOC_STATUS.Uploaded : DOC_STATUS.Verified;
  const now = new Date();
  const originalFileName = sanitizeFileName(input.file.name);
  const identifierMasked = maskIdentifier(input.identifier);

  // Step 9 — persist bytes first (no SQL row without a file), then metadata.
  let storageKey: string;
  try {
    storageKey = await saveUploadedFile(
      input.file.bytes,
      `platform/${companyId}/${ownerEntityType.toLowerCase()}/${ownerEntityId}`,
      `upload.${ext}`,
    );
  } catch (err) {
    throw new DocumentError(400, err instanceof Error ? err.message : 'Could not store file');
  }

  let created: DocumentRow | null = null;
  for (let attempt = 0; attempt < REF_ALLOC_RETRIES && !created; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const documentRef = await nextDocumentRef(tx, companyId, now);
        const row = await tx.platformDocument.create({
          data: {
            companyId,
            documentTypeId: type.id,
            ownerEntityType,
            ownerEntityId,
            documentRef,
            versionNo,
            supersedesDocumentId: currentVerified?.id ?? null,
            storageKey,
            originalFileName,
            mimeType: mimeTypeForExtension(ext),
            fileSizeBytes: BigInt(input.file.bytes.length),
            sha256Hash,
            identifierMasked,
            issueDate: input.issueDate ?? null,
            expiryDate: input.expiryDate ?? null,
            verificationStatus: initialStatus,
            verifiedByUserId: verificationRequired ? null : actor.userId ?? null,
            verifiedAt: verificationRequired ? null : now,
            scanStatus,
            uploadedByUserId: actor.userId ?? null,
            uploadedAt: now,
          },
        });
        if (!verificationRequired && currentVerified) {
          await tx.platformDocument.update({
            where: { id: currentVerified.id },
            data: { verificationStatus: DOC_STATUS.Superseded, supersededByDocumentId: row.id },
          });
        }
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err) && attempt < REF_ALLOC_RETRIES - 1) continue;
      throw err;
    }
  }
  if (!created) throw new DocumentError(409, 'Could not allocate a document reference');

  // Step 11 — audit (actor, IP via actor.ipAddress, hash, size).
  await audit({
    companyId,
    entityType: ENTITY_TYPE,
    entityId: created.id,
    entityRef: created.documentRef,
    action: 'CREATE',
    actor,
    after: auditShape(created),
    remark: `Uploaded ${type.code} v${versionNo} for ${ownerEntityType}#${ownerEntityId}`,
  });
  if (!verificationRequired && currentVerified) {
    await audit({
      companyId,
      entityType: ENTITY_TYPE,
      entityId: currentVerified.id,
      action: 'SUPERSEDE',
      actor,
      before: { verificationStatus: DOC_STATUS.Verified },
      after: { verificationStatus: DOC_STATUS.Superseded, supersededByDocumentId: created.id },
    });
  }

  // Step 12 — notify.
  await emitPlatformEvent(companyId, 'DOCUMENT_UPLOADED', {
    ...eventContext(created, type),
    ...(verificationRequired && type.verifierRole ? { recipients: [`ROLE:${type.verifierRole}`] } : {}),
  });
  if (!verificationRequired) {
    await emitPlatformEvent(companyId, 'DOCUMENT_VERIFIED', eventContext(created, type));
  }

  return toView(created, type, await findDuplicate(created));
}

// ---------------------------------------------------------------- state machine

async function transition(
  companyId: number,
  documentId: number,
  to: DocStatus,
  actor: PlatformActor,
  action: string,
  patch: Prisma.PlatformDocumentUpdateInput,
  remark?: string | null,
): Promise<{ doc: DocumentRow; before: DocumentRow; type: DocumentTypeRow }> {
  const { doc: before, type } = await loadDocument(companyId, documentId);
  assertTransition(before.verificationStatus, to);
  const doc = await prisma.platformDocument.update({
    where: { id: before.id },
    data: { verificationStatus: to, ...patch },
  });
  await audit({
    companyId,
    entityType: ENTITY_TYPE,
    entityId: doc.id,
    entityRef: doc.documentRef,
    action,
    actor,
    before: auditShape(before),
    after: auditShape(doc),
    remark: remark ?? null,
  });
  return { doc, before, type };
}

export async function claimForVerification(companyId: number, documentId: number, actor: PlatformActor): Promise<PlatformDocumentView> {
  const { doc: current } = await loadDocument(companyId, documentId);
  if (actor.userId != null && current.uploadedByUserId != null && actor.userId === current.uploadedByUserId) {
    throw new DocumentError(403, 'The uploader may not verify their own upload');
  }
  const { doc, type } = await transition(companyId, documentId, DOC_STATUS.UnderVerification, actor, 'CLAIM', {
    verifiedByUserId: actor.userId ?? null,
  });
  return toView(doc, type, await findDuplicate(doc));
}

export async function verifyDocument(companyId: number, documentId: number, actor: PlatformActor, remark?: string): Promise<PlatformDocumentView> {
  const { doc: current, type: t } = await loadDocument(companyId, documentId);
  if (actor.userId != null && current.uploadedByUserId != null && actor.userId === current.uploadedByUserId) {
    throw new DocumentError(403, 'The uploader may not verify their own upload');
  }
  if (t.expiryRequired && !current.expiryDate) {
    throw new DocumentError(400, `${t.code} cannot be verified without an expiry date`);
  }
  if (current.verificationStatus !== DOC_STATUS.UnderVerification) {
    // Only a claimed document can be verified (§16.1); Uploaded → Verified is reserved for no-verification types.
    throw new DocumentError(409, `Cannot move a document from ${current.verificationStatus} to Verified`);
  }
  const now = new Date();
  const { doc, type } = await transition(companyId, documentId, DOC_STATUS.Verified, actor, 'VERIFY', {
    verifiedByUserId: actor.userId ?? null,
    verifiedAt: now,
    verificationRemark: remark?.slice(0, 500) ?? null,
    rejectionReasonCode: null,
  }, remark);

  // §16.3 — the prior version moves to Superseded at the instant this one is Verified.
  if (doc.supersedesDocumentId) {
    const prior = await prisma.platformDocument.findFirst({
      where: { id: doc.supersedesDocumentId, companyId, deletedAt: null, verificationStatus: DOC_STATUS.Verified },
    });
    if (prior) {
      const superseded = await prisma.platformDocument.update({
        where: { id: prior.id },
        data: { verificationStatus: DOC_STATUS.Superseded, supersededByDocumentId: doc.id },
      });
      await audit({
        companyId,
        entityType: ENTITY_TYPE,
        entityId: prior.id,
        entityRef: prior.documentRef,
        action: 'SUPERSEDE',
        actor,
        before: auditShape(prior),
        after: auditShape(superseded),
        remark: `Superseded by ${doc.documentRef}`,
      });
    }
  }

  await emitPlatformEvent(companyId, 'DOCUMENT_VERIFIED', eventContext(doc, type));
  return toView(doc, type, await findDuplicate(doc));
}

export async function rejectDocument(
  companyId: number,
  documentId: number,
  actor: PlatformActor,
  reasonCode: RejectionReasonCode,
  remark: string,
): Promise<PlatformDocumentView> {
  if (!(REJECTION_REASON_CODES as readonly string[]).includes(reasonCode)) {
    throw new DocumentError(400, `Unknown rejection reason ${reasonCode}`);
  }
  if (!remark || remark.trim().length < 10) {
    throw new DocumentError(400, 'A rejection remark of at least 10 characters is required');
  }
  const { doc: rejected, type } = await transition(companyId, documentId, DOC_STATUS.Rejected, actor, 'REJECT', {
    verifiedByUserId: actor.userId ?? null,
    verifiedAt: new Date(),
    verificationRemark: remark.trim().slice(0, 500),
    rejectionReasonCode: reasonCode,
  }, remark);
  // §16.1 — Rejected → ReuploadRequired is automatic.
  const { doc } = await transition(companyId, documentId, DOC_STATUS.ReuploadRequired, actor, 'REUPLOAD_REQUIRED', {});
  await emitPlatformEvent(companyId, 'DOCUMENT_REJECTED', {
    ...eventContext(doc, type, { RejectionReason: `${reasonCode}: ${rejected.verificationRemark}` }),
    ...(reasonCode === 'SUSPECTED_FORGERY' ? { priority: 'URGENT' as const, recipients: [...HR_MANAGER_ROLE_CODES.map((r) => `ROLE:${r}`)] } : {}),
  });
  return toView(doc, type, await findDuplicate(doc));
}

export async function withdrawDocument(companyId: number, documentId: number, actor: PlatformActor): Promise<PlatformDocumentView> {
  const { doc: current } = await loadDocument(companyId, documentId);
  const isOwner =
    (current.ownerEntityType === 'EMPLOYEE' && actor.employeeId != null && actor.employeeId === current.ownerEntityId) ||
    (actor.userId != null && current.uploadedByUserId != null && actor.userId === current.uploadedByUserId);
  if (!isOwner) throw new DocumentError(403, 'Only the document owner may withdraw it');
  const { doc, type } = await transition(companyId, documentId, DOC_STATUS.Withdrawn, actor, 'WITHDRAW', {});
  return toView(doc, type, await findDuplicate(doc));
}

export async function revokeVerification(companyId: number, documentId: number, actor: PlatformActor, reason: string): Promise<PlatformDocumentView> {
  if (!reason || !reason.trim()) throw new DocumentError(400, 'A reason is required to revoke a verification');
  const roleCode = await roleCodeOf(actor.userId);
  if (!roleCode || !HR_MANAGER_ROLE_CODES.includes(roleCode)) {
    throw new DocumentError(403, 'Only the HR Manager may revoke a verification');
  }
  // Revocation appends; the prior verification record (verifiedBy/At/remark) is left untouched.
  const { doc, type } = await transition(companyId, documentId, DOC_STATUS.Revoked, actor, 'REVOKE', {}, reason.trim());
  return toView(doc, type, await findDuplicate(doc));
}

// ---------------------------------------------------------------- reads

export async function getDocument(companyId: number, documentId: number): Promise<PlatformDocumentView> {
  const { doc, type } = await loadDocument(companyId, documentId);
  return toView(doc, type, await findDuplicate(doc));
}

export async function listDocuments(
  companyId: number,
  owner: { ownerEntityType: string; ownerEntityId: number },
  opts?: { includeSuperseded?: boolean },
): Promise<PlatformDocumentView[]> {
  const ownerEntityType = owner.ownerEntityType.toUpperCase();
  const rows = await prisma.platformDocument.findMany({
    where: {
      companyId,
      ownerEntityType,
      ownerEntityId: owner.ownerEntityId,
      deletedAt: null,
      ...(opts?.includeSuperseded ? {} : { verificationStatus: { not: DOC_STATUS.Superseded } }),
    },
    orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
  });
  if (rows.length === 0) return [];
  const types = await prisma.platformDocumentType.findMany({
    where: { companyId, id: { in: [...new Set(rows.map((r) => r.documentTypeId))] } },
  });
  const typeById = new Map(types.map((t) => [t.id, t]));
  // Duplicate detection over the fetched set (same owner, so the set is complete).
  const seen = new Map<string, number>();
  const out: PlatformDocumentView[] = [];
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const key = `${r.documentTypeId}:${r.sha256Hash}`;
    const dup = seen.get(key) ?? null;
    if (dup === null) seen.set(key, r.id);
    const type = typeById.get(r.documentTypeId);
    if (!type) continue;
    out.push(toView(r, type, dup));
  }
  return out.sort((a, b) => (b.uploadedAt.getTime() - a.uploadedAt.getTime()) || b.id - a.id);
}

export async function completeness(
  companyId: number,
  owner: { ownerEntityType: string; ownerEntityId: number },
  stage?: string,
): Promise<{ complete: boolean; missing: string[]; pending: string[]; expired: string[] }> {
  const ownerEntityType = owner.ownerEntityType.toUpperCase();
  const [types, docs] = await Promise.all([
    prisma.platformDocumentType.findMany({
      where: { companyId, appliesToEntity: ownerEntityType },
      select: { id: true, code: true, appliesToEntity: true, mandatoryFlag: true, mandatoryFromStage: true, isActive: true },
    }),
    prisma.platformDocument.findMany({
      where: { companyId, ownerEntityType, ownerEntityId: owner.ownerEntityId, deletedAt: null },
      select: { documentTypeId: true, verificationStatus: true },
    }),
  ]);
  const codeById = new Map(types.map((t) => [t.id, t.code]));
  return computeCompleteness(
    types,
    docs
      .filter((d) => codeById.has(d.documentTypeId))
      .map((d) => ({ documentTypeCode: codeById.get(d.documentTypeId)!, verificationStatus: d.verificationStatus })),
    ownerEntityType,
    stage,
  );
}

// ---------------------------------------------------------------- access (§17.3 simplified)

export type DocumentCaller = {
  userId: number | null;
  employeeId: number | null;
  roleCode: string | null;
};

/**
 * View/download is permitted when the caller is the owner employee, holds
 * an HR-manager role, or is the owner's L1 reporting manager and the class
 * is PUBLIC/INTERNAL. RESTRICTED and CONFIDENTIAL are never served to
 * managers. Revoked and Withdrawn files are served to HR roles only.
 */
export async function canAccessDocument(companyId: number, view: PlatformDocumentView, caller: DocumentCaller): Promise<boolean> {
  if (view.companyId !== companyId) return false;
  if (caller.roleCode && HR_MANAGER_ROLE_CODES.includes(caller.roleCode)) return true;
  const terminalHidden = view.verificationStatus === DOC_STATUS.Revoked || view.verificationStatus === DOC_STATUS.Withdrawn;
  if (view.ownerEntityType !== 'EMPLOYEE' || caller.employeeId == null) return false;
  if (caller.employeeId === view.ownerEntityId) return !terminalHidden;
  if (view.documentClass !== 'PUBLIC' && view.documentClass !== 'INTERNAL') return false;
  if (terminalHidden) return false;
  const owner = await prisma.employee.findFirst({
    where: { id: view.ownerEntityId, companyId, deletedAt: null },
    select: { reportingManagerId: true },
  });
  return owner?.reportingManagerId === caller.employeeId;
}

/** Bytes for download; the caller must have passed canAccessDocument. Audits CONFIDENTIAL/RESTRICTED downloads (§17.4). */
export async function readDocumentBytes(companyId: number, documentId: number, actor: PlatformActor): Promise<{ view: PlatformDocumentView; bytes: Buffer }> {
  const { doc, type } = await loadDocument(companyId, documentId);
  let bytes: Buffer;
  try {
    bytes = await readStoredFile(doc.storageKey);
  } catch {
    throw new DocumentError(404, 'File not found');
  }
  if (type.documentClass === 'CONFIDENTIAL' || type.documentClass === 'RESTRICTED') {
    await audit({
      companyId,
      entityType: ENTITY_TYPE,
      entityId: doc.id,
      entityRef: doc.documentRef,
      action: 'DOWNLOAD',
      actor,
      remark: `${type.documentClass} ${type.code} for ${doc.ownerEntityType}#${doc.ownerEntityId}`,
    });
  }
  return { view: toView(doc, type), bytes };
}

// ---------------------------------------------------------------- expiry (§17.1)

export async function runExpirySweep(companyId?: number, today?: Date): Promise<{ expired: number; alerted: number }> {
  const day = today ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) : istToday();
  const actor: PlatformActor = { userId: null, source: 'system' };
  const docs = await prisma.platformDocument.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
      verificationStatus: DOC_STATUS.Verified,
      expiryDate: { not: null },
    },
  });
  if (docs.length === 0) return { expired: 0, alerted: 0 };
  const types = await prisma.platformDocumentType.findMany({
    where: { id: { in: [...new Set(docs.map((d) => d.documentTypeId))] } },
  });
  const typeById = new Map(types.map((t) => [t.id, t]));

  let expired = 0;
  let alerted = 0;
  for (const doc of docs) {
    const type = typeById.get(doc.documentTypeId);
    if (!type || !doc.expiryDate) continue;
    const days = daysUntil(doc.expiryDate, day);
    if (days < 0) {
      const updated = await prisma.platformDocument.update({
        where: { id: doc.id },
        data: { verificationStatus: DOC_STATUS.Expired },
      });
      await audit({
        companyId: doc.companyId,
        entityType: ENTITY_TYPE,
        entityId: doc.id,
        entityRef: doc.documentRef,
        action: 'EXPIRE',
        actor,
        before: auditShape(doc),
        after: auditShape(updated),
        remark: `Expired on ${dateOnly(doc.expiryDate)}`,
      });
      expired++;
      continue;
    }
    if (parseAlertOffsets(type.expiryAlertOffsets).includes(days)) {
      await emitPlatformEvent(doc.companyId, 'DOCUMENT_EXPIRY_ALERT', {
        ...eventContext(doc, type),
        recipients: ['SUBJECT_EMPLOYEE', 'SUBJECT_MANAGER_L1'],
        data: { Document: { TypeName: type.name, TypeCode: type.code, Ref: doc.documentRef, Status: doc.verificationStatus, ExpiryDate: dateOnly(doc.expiryDate), DaysToExpiry: days } },
      });
      alerted++;
    }
  }
  return { expired, alerted };
}

export { PENDING_STATUSES };
