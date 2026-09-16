/**
 * Types and error class shared by the workflow engine modules.
 */

import type { PlatformActor } from '../contracts';

/** Lifecycle statuses (BRD §6.3). Exactly these; modules add none. */
export const WF_STATUS = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  ValidationFailed: 'Validation Failed',
  PendingApproval: 'Pending Approval',
  Returned: 'Returned',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
  Reopened: 'Reopened',
} as const;
export type WorkflowStatus = (typeof WF_STATUS)[keyof typeof WF_STATUS];

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([WF_STATUS.Approved, WF_STATUS.Rejected, WF_STATUS.Cancelled]);

/** Slot statuses. */
export const SLOT_STATUS = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Returned: 'Returned',
  Skipped: 'Skipped',
  Replaced: 'Replaced',
  Vacant: 'Vacant',
} as const;
export type SlotStatus = (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];

/** Error carrying an HTTP status and a stable code such as WF-MATRIX-404. */
export class WorkflowError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Resolved values of the §7.2 condition fields, captured at Submit in contextJson. */
export type RequestContext = {
  amount?: number | null;
  designationCode?: string | null;
  departmentCode?: string | null;
  gradeCode?: string | null;
  employmentType?: string | null;
  locationCode?: string | null;
  costCentreCode?: string | null;
  requestSubType?: string | null;
  /** Informational — ids used for the resolution, not matched against. */
  subjectEmpId?: number | null;
  departmentId?: number | null;
  designationId?: number | null;
};

export type WorkflowSlotView = {
  id: number;
  levelNo: number;
  sequence: number;
  parallelGroup: number | null;
  approverType: string;
  approverRef: string;
  resolvedEmpId: number | null;
  resolvedUserId: number | null;
  isMandatory: boolean;
  quorumRule: string;
  quorumN: number | null;
  status: string;
  escalationHop: number;
  actedByEmpId: number | null;
  actedByUserId: number | null;
  onBehalfOfEmpId: number | null;
  delegationId: number | null;
  actedAt: Date | null;
  remark: string | null;
};

export type WorkflowActionView = {
  id: number;
  verb: string;
  fromStatus: string | null;
  toStatus: string;
  levelNo: number | null;
  actorUserId: number | null;
  actorEmpId: number | null;
  onBehalfOfEmpId: number | null;
  delegationId: number | null;
  remark: string | null;
  detail: unknown;
  createdAt: Date;
};

export type WorkflowRequestView = {
  id: number;
  companyId: number;
  requestNo: string;
  requestTypeCode: string;
  moduleCode: string;
  sourceEntityType: string;
  sourceEntityId: number;
  title: string;
  requesterEmpId: number;
  requesterUserId: number | null;
  subjectEmpId: number | null;
  onBehalfOfEmpId: number | null;
  amount: string | null;
  requestSubType: string | null;
  priority: string;
  payload: unknown;
  context: RequestContext | null;
  currentStatus: string;
  currentLevel: number;
  matrixId: number | null;
  matrixVersionNo: number | null;
  snapshotId: number | null;
  levelEnteredAt: Date | null;
  dueAt: Date | null;
  slaBreachCount: number;
  escalationExhausted: boolean;
  submittedAt: Date | null;
  decidedAt: Date | null;
  decisionRemark: string | null;
  validationErrors: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  slots: WorkflowSlotView[];
  actions: WorkflowActionView[];
};

export type CreateDraftInput = {
  companyId: number;
  requestTypeCode: string;
  sourceEntityType: string;
  sourceEntityId: number;
  title: string;
  requesterEmpId: number;
  subjectEmpId?: number | null;
  onBehalfOfEmpId?: number | null;
  amount?: number | string | null;
  requestSubType?: string | null;
  priority?: 'URGENT' | 'NORMAL' | 'LOW';
  payload?: unknown;
  actor: PlatformActor;
};

export type ResolvedApprover = { empId: number | null; userId: number | null };
