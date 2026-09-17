/**
 * Pure rules for the Document service (BRD Part C, §15–18). No I/O here —
 * everything in this file is unit-testable without a database, and
 * service.ts composes these helpers around Prisma and file storage.
 */

/** Verification states (§16.1). Stored without spaces to fit NVarChar(24). */
export const DOC_STATUS = {
  Uploaded: 'Uploaded',
  UnderVerification: 'UnderVerification',
  Verified: 'Verified',
  Rejected: 'Rejected',
  ReuploadRequired: 'ReuploadRequired',
  Withdrawn: 'Withdrawn',
  Revoked: 'Revoked',
  Expired: 'Expired',
  Superseded: 'Superseded',
} as const;

export type DocStatus = (typeof DOC_STATUS)[keyof typeof DOC_STATUS];

/** States that count as "active files" for the maxFileCount check (§15.4 step 5). */
export const ACTIVE_STATUSES: readonly DocStatus[] = [
  DOC_STATUS.Uploaded,
  DOC_STATUS.UnderVerification,
  DOC_STATUS.Verified,
];

/** States in which the owner's document is still "in flight" towards a verdict. */
export const PENDING_STATUSES: readonly DocStatus[] = [DOC_STATUS.Uploaded, DOC_STATUS.UnderVerification];

/** §16.1 transitions implemented in this iteration. Anything not listed is a 409. */
export const TRANSITIONS: Readonly<Record<string, readonly DocStatus[]>> = {
  [DOC_STATUS.Uploaded]: [DOC_STATUS.UnderVerification, DOC_STATUS.Withdrawn],
  // Review has three verdicts, per the KUN Document Module BRD: Verified,
  // Rejected, or Resubmission Required. ReuploadRequired is reachable straight
  // from review so HR can ask for a better copy without recording a rejection.
  [DOC_STATUS.UnderVerification]: [DOC_STATUS.Verified, DOC_STATUS.Rejected, DOC_STATUS.ReuploadRequired],
  // Rejected is a verdict in its own right and no longer cascades on its own;
  // HR may still follow it with an explicit resubmission request.
  [DOC_STATUS.Rejected]: [DOC_STATUS.ReuploadRequired],
  [DOC_STATUS.Verified]: [DOC_STATUS.Expired, DOC_STATUS.Superseded, DOC_STATUS.Revoked],
  [DOC_STATUS.ReuploadRequired]: [],
  [DOC_STATUS.Withdrawn]: [],
  [DOC_STATUS.Revoked]: [],
  [DOC_STATUS.Expired]: [],
  [DOC_STATUS.Superseded]: [],
};

export const REJECTION_REASON_CODES = [
  'ILLEGIBLE',
  'WRONG_DOCUMENT',
  'EXPIRED_AT_UPLOAD',
  'DETAILS_MISMATCH',
  'INCOMPLETE_PAGES',
  'SUSPECTED_FORGERY',
  'OTHER',
] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export const DOCUMENT_CLASSES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
export const DOCUMENT_CATEGORIES = [
  'IDENTITY', 'EDUCATION', 'EMPLOYMENT', 'STATUTORY', 'MEDICAL', 'FINANCIAL',
  'TRAINING', 'ASSET', 'EXIT', 'COMPANY', 'OTHER',
] as const;
export const OWNER_ENTITY_TYPES = ['EMPLOYEE', 'CANDIDATE', 'TRAINING', 'ASSET', 'CONTRACTOR', 'COMPANY'] as const;

/** Roles treated as "HR Manager" for revoke and for unrestricted view (§16.2, §17.3). */
export const HR_MANAGER_ROLE_CODES: readonly string[] = ['hr-admin', 'company-admin'];

/** Error carrying an HTTP status so routes can map it without leaking internals. */
export class DocumentError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DocumentError';
    this.status = status;
  }
}

export function isTransitionAllowed(from: string, to: DocStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: string, to: DocStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new DocumentError(409, `Cannot move a document from ${from} to ${to}`);
  }
}

// ---------------------------------------------------------------- files

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp4: 'video/mp4',
};

/** Lower-case extension without the dot, or '' when the name has none. */
export function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx === base.length - 1) return '';
  return base.slice(idx + 1).toLowerCase();
}

/** Parse a comma-separated list such as "pdf, JPG,png" into lower-case trimmed tokens. */
export function parseCsv(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** §15.4 step 2 — extension in allowedFileTypes, case-insensitive. jpeg and jpg are aliases. */
export function isExtensionAllowed(ext: string, allowedFileTypes: string): boolean {
  const allowed = new Set(parseCsv(allowedFileTypes));
  const e = ext.toLowerCase();
  if (allowed.has(e)) return true;
  if (e === 'jpeg' && allowed.has('jpg')) return true;
  if (e === 'jpg' && allowed.has('jpeg')) return true;
  return false;
}

/** MIME type derived from the validated extension — never taken from the client (§15.2). */
export function mimeTypeForExtension(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'application/octet-stream';
}

export type MagicType = 'pdf' | 'jpg' | 'png' | 'webp' | 'zip' | 'ole' | 'mp4' | null;

/** §15.4 step 3 — detect the file signature from the leading bytes. */
export function detectMagicType(bytes: Uint8Array): MagicType {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'pdf'; // %PDF-
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp'; // RIFF....WEBP
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'zip'; // docx / pptx
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  ) {
    return 'ole'; // doc / ppt
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'mp4'; // ....ftyp
  }
  return null;
}

const MAGIC_FOR_EXT: Record<string, MagicType> = {
  pdf: 'pdf',
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  docx: 'zip',
  pptx: 'zip',
  doc: 'ole',
  ppt: 'ole',
  mp4: 'mp4',
};

/** True when the signature in `bytes` matches what the declared extension requires. */
export function magicMatchesExtension(bytes: Uint8Array, ext: string): boolean {
  const expected = MAGIC_FOR_EXT[ext.toLowerCase()];
  if (expected === undefined) return false; // unknown extension: no signature known, reject
  return detectMagicType(bytes) === expected;
}

/** §15.4 step 4 — size in bytes must not exceed maxFileSizeMb (and must be > 0). */
export function isSizeWithinLimit(sizeBytes: number, maxFileSizeMb: number): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return false;
  return sizeBytes <= maxFileSizeMb * 1024 * 1024;
}

/** Strip path components and control characters; cap to the column width. */
export function sanitizeFileName(name: string): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, '').replace(/^\.+/, '').trim();
  return (cleaned || 'file').slice(0, 260);
}

// ---------------------------------------------------------------- identifiers

/**
 * §18 — keep the last four characters, replace everything else with X.
 * Whitespace and separators are dropped first so "1234 5678 9012" and
 * "1234-5678-9012" both become XXXXXXXX9012. Never returns the raw value.
 */
export function maskIdentifier(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const compact = String(raw).replace(/[\s-]/g, '').toUpperCase();
  if (!compact) return null;
  const keep = Math.min(4, compact.length);
  const masked = 'X'.repeat(compact.length - keep) + compact.slice(compact.length - keep);
  return masked.slice(0, 40);
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** §18.2 — PAN is five letters, four digits, one letter; the fourth character is P for an individual. */
export function isValidPan(value: string): boolean {
  const v = value.trim().toUpperCase();
  return PAN_REGEX.test(v) && v[3] === 'P';
}

// ---------------------------------------------------------------- reference numbers

/** Indian financial year code: Apr-2025..Mar-2026 → "2526". Uses the UTC calendar date. */
export function financialYearCode(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1;
  return `${String(startYear % 100).padStart(2, '0')}${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** DOC/<FY>/<serial zero-padded 6>. */
export function formatDocumentRef(fy: string, serial: number): string {
  return `DOC/${fy}/${String(serial).padStart(6, '0')}`;
}

/** Serial parsed from a ref, or 0 when the ref is absent or malformed. */
export function serialFromDocumentRef(ref: string | null | undefined): number {
  if (!ref) return 0;
  const m = /^DOC\/\d{4}\/(\d+)$/.exec(ref);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------- dates

/** UTC-midnight Date for the IST calendar day containing `now`. */
export function istToday(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 330 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** Whole days from `today` to `date` (both treated as UTC calendar dates). Negative when in the past. */
export function daysUntil(date: Date, today: Date): number {
  const a = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** "60,30,15,7,0" → [60,30,15,7,0]; blank → the §15.1 default. */
export function parseAlertOffsets(value: string | null | undefined): number[] {
  const parts = parseCsv(value).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  return parts.length ? parts : [60, 30, 15, 7, 0];
}

/** Milliseconds from `now` until the next 08:00 IST (strictly in the future). */
export function msUntilNextIstHour(hour: number, now: Date = new Date()): number {
  const IST = 330 * 60 * 1000;
  const shifted = new Date(now.getTime() + IST);
  let target = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour, 0, 0, 0);
  if (target <= shifted.getTime()) target += 86_400_000;
  return target - shifted.getTime();
}

// ---------------------------------------------------------------- completeness

export type CompletenessType = {
  code: string;
  appliesToEntity: string;
  mandatoryFlag: boolean;
  mandatoryFromStage: string | null;
  isActive: boolean;
};

export type CompletenessDoc = {
  documentTypeCode: string;
  verificationStatus: string;
};

export type CompletenessResult = { complete: boolean; missing: string[]; pending: string[]; expired: string[] };

/**
 * §16.4 — completeness over the mandatory types for an entity type. A type
 * is satisfied by a Verified document; an in-flight one is "pending"; an
 * Expired one with no verified replacement is "expired"; otherwise "missing".
 * When `stage` is given, only types mandatory at that stage (or with no
 * stage) are considered.
 */
export function computeCompleteness(
  types: CompletenessType[],
  docs: CompletenessDoc[],
  ownerEntityType: string,
  stage?: string,
): CompletenessResult {
  const required = types.filter(
    (t) =>
      t.isActive &&
      t.mandatoryFlag &&
      t.appliesToEntity === ownerEntityType &&
      (!stage || !t.mandatoryFromStage || t.mandatoryFromStage === stage),
  );
  const byType = new Map<string, string[]>();
  for (const d of docs) {
    const list = byType.get(d.documentTypeCode) ?? [];
    list.push(d.verificationStatus);
    byType.set(d.documentTypeCode, list);
  }
  const missing: string[] = [];
  const pending: string[] = [];
  const expired: string[] = [];
  for (const t of required) {
    const statuses = byType.get(t.code) ?? [];
    if (statuses.includes(DOC_STATUS.Verified)) continue;
    if (statuses.some((s) => (PENDING_STATUSES as readonly string[]).includes(s))) pending.push(t.code);
    else if (statuses.includes(DOC_STATUS.Expired)) expired.push(t.code);
    else missing.push(t.code);
  }
  return { complete: missing.length === 0 && pending.length === 0 && expired.length === 0, missing, pending, expired };
}
