/**
 * Shared platform types. Every platform service (workflow, notification,
 * document, snapshot, audit) and every module that calls one imports its
 * cross-service shapes from here, so no service needs to import another
 * service's implementation to agree on a type.
 */

export type ModuleCode =
  | 'CORE' | 'ATTN' | 'LEAV' | 'PAYR' | 'LOAN' | 'RECR'
  | 'TRDV' | 'ESSV' | 'PERF' | 'FNFS' | 'STAT' | 'RPTG' | 'PLAT';

/** Who is performing an action. userId comes from the x-user-id header. */
export type PlatformActor = {
  userId: number | null;
  employeeId?: number | null;
  /** Set when acting under a delegation or HR acting for a shop-floor employee. */
  onBehalfOfEmployeeId?: number | null;
  source?: 'user' | 'system' | 'delegate' | 'import';
  ipAddress?: string | null;
};

export const SYSTEM_ACTOR: PlatformActor = { userId: null, source: 'system' };

export type EntityRef = { entityType: string; entityId: number };

/**
 * Recipient expressions (BRD §13.2). Resolved by the notification service:
 *   'REQUESTER' | 'SUBJECT_EMPLOYEE' | 'REQUESTER_MANAGER_L1' |
 *   'REQUESTER_MANAGER_L2' | 'SUBJECT_MANAGER_L1' | 'CURRENT_APPROVERS' |
 *   'PREVIOUS_APPROVERS' | 'ROLE:<Role.code>' | 'EMPLOYEE:<employeeCode>' |
 *   'USER:<userId>' | 'EXTERNAL:<email>'
 */
export type RecipientExpression = string;

/**
 * Context handed to the notification service with an event. Namespaced keys
 * become placeholder namespaces ({{Employee.FullName}}, {{Request.No}} …).
 * The service resolves Employee/Recipient/Company/System itself from ids;
 * a module supplies what only it knows (Request, Document, Payroll …).
 */
export type PlatformEventContext = {
  correlationId?: string;
  moduleCode?: ModuleCode;
  sourceEntityType?: string;
  sourceEntityId?: number;
  /** Employee the event is about. */
  subjectEmpId?: number;
  /** Employee who initiated the transaction, if different. */
  requesterEmpId?: number;
  /** Workflow request id, when the event arose from one. */
  requestId?: number;
  /** Explicit recipients; merged with NotificationEvent.defaultRecipients. */
  recipients?: RecipientExpression[];
  /** Overrides NotificationEvent.defaultPriority. */
  priority?: 'URGENT' | 'NORMAL' | 'LOW';
  /** Deep link for the in-app message, e.g. /approvals/inbox/123 */
  linkPath?: string;
  /** Placeholder namespaces supplied by the raising module. */
  data?: Record<string, Record<string, unknown>>;
};
