import type { BadgeTone } from '@/components/ui';

export type OwnerEmployee = { id: number; employeeCode: string; name: string };

export type PlatformDocument = {
  id: number;
  documentTypeId: number;
  documentTypeCode: string;
  documentTypeName: string;
  documentClass: string;
  category: string;
  businessCategory: string;
  uploadMode: string;
  ownerEntityType: string;
  ownerEntityId: number;
  ownerEmployee: OwnerEmployee | null;
  documentRef: string;
  versionNo: number;
  supersedesDocumentId: number | null;
  supersededByDocumentId: number | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  identifierMasked: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  verificationRemark: string | null;
  rejectionReasonCode: string | null;
  uploadedAt: string;
  uploadedByUserId: number | null;
  duplicateOf: number | null;
};

export type PlatformDocumentType = {
  id: number;
  code: string;
  name: string;
  businessCategory: string;
  uploadMode: string;
  appliesToEntity: string;
  verificationRequired: boolean;
  expiryRequired: boolean;
  allowedFileTypes: string;
  maxFileSizeMb: number;
};

export const STATUS_TONE: Record<string, BadgeTone> = {
  Verified: 'success',
  Uploaded: 'warning',
  UnderVerification: 'warning',
  ReuploadRequired: 'danger',
  Rejected: 'danger',
  Expired: 'danger',
  Revoked: 'danger',
  Withdrawn: 'neutral',
  Superseded: 'neutral',
};

export const STATUS_LABEL: Record<string, string> = {
  Uploaded: 'Pending verification',
  UnderVerification: 'Under verification',
  Verified: 'Verified',
  Rejected: 'Rejected',
  ReuploadRequired: 'Resubmission required',
  Expired: 'Expired',
  Revoked: 'Revoked',
  Withdrawn: 'Withdrawn',
  Superseded: 'Previous version',
};

export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'ILLEGIBLE', label: 'Illegible / poor scan' },
  { value: 'WRONG_DOCUMENT', label: 'Wrong document' },
  { value: 'EXPIRED_AT_UPLOAD', label: 'Already expired' },
  { value: 'DETAILS_MISMATCH', label: 'Details mismatch' },
  { value: 'INCOMPLETE_PAGES', label: 'Incomplete pages' },
  { value: 'SUSPECTED_FORGERY', label: 'Suspected forgery' },
  { value: 'OTHER', label: 'Other' },
];

export async function readApiError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  return json?.error ?? `Request failed (${res.status})`;
}
