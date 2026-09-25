/**
 * Fire-and-forget notifications for ESS request journeys.
 *
 * Wraps `notify()` so a call site is one line, and — more importantly — so a
 * notification failure can never fail the transaction that raised it. An SMTP
 * outage must not stop a leave approval from being recorded, so every error is
 * swallowed and logged rather than thrown.
 *
 * Event codes are `<KIND>_<ACTION>`, registered by
 * `scripts/seed-ess-notification-events.mjs`. A code that is not registered
 * makes `notify()` warn and return without sending, so wiring a call site
 * before its event exists is safe.
 */

import { notify } from '@/lib/platform/notification/service';
import { prisma } from '@/lib/prisma';

export type EssRequestKind =
  | 'LEAVE'
  | 'PERMISSION'
  | 'MISPUNCH'
  | 'OT'
  | 'COMP_OFF'
  | 'SHIFT_CHANGE'
  | 'WFH'
  | 'ON_DUTY'
  | 'VISITOR_PASS';

export type EssRequestAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CONFLICT' | 'CONFLICT_RESOLVED';

export interface EssNotifyOptions {
  /**
   * Omit on routes that have no company scope of their own (the attendance
   * request routes authorize by reporting-manager hierarchy, not by tenant,
   * so they never call getCompanyId). It is then resolved from the employee,
   * which is the same tenant the request belongs to by definition.
   */
  companyId?: number;
  kind: EssRequestKind;
  action: EssRequestAction;
  /** The employee the request belongs to — the one told the outcome. */
  employeeId: number;
  /** Row id of the request, for the deep link and for tracing. */
  requestId?: number;
  /** Human period, e.g. "12 Sep 2026 – 14 Sep 2026" or "12 Sep 2026". */
  period?: string;
  /** Applied reason, or the rejection reason on a REJECTED event. */
  reason?: string;
  /** Where the in-app message should take the reader. */
  linkPath?: string;
}

export async function notifyEssRequest(opts: EssNotifyOptions): Promise<void> {
  const eventCode = `${opts.kind}_${opts.action}`;
  try {
    const companyId =
      opts.companyId ??
      (
        await prisma.employee.findUnique({
          where: { id: opts.employeeId },
          select: { companyId: true },
        })
      )?.companyId;
    if (!companyId) {
      console.error(`[ess-notify] ${eventCode}: no company for employee ${opts.employeeId}`);
      return;
    }

    await notify(companyId, eventCode, {
      subjectEmpId: opts.employeeId,
      requesterEmpId: opts.employeeId,
      sourceEntityType: opts.kind,
      sourceEntityId: opts.requestId,
      linkPath: opts.linkPath,
      data: {
        Request: {
          Id: opts.requestId ?? '',
          Period: opts.period ?? '',
          Reason: opts.reason ?? '',
          Status: opts.action,
        },
      },
    });
  } catch (err) {
    // Deliberately not rethrown: see the note at the top of this file.
    console.error(`[ess-notify] ${eventCode} failed for employee ${opts.employeeId}`, err);
  }
}

/** "12 Sep 2026 – 14 Sep 2026", or a single date when both ends match. */
export function formatPeriod(from: Date | string, to?: Date | string | null): string {
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const a = fmt(from);
  if (!to) return a;
  const b = fmt(to);
  return a === b ? a : `${a} – ${b}`;
}

/** A punch recorded on an approved leave day — what the HR queue needs to be told. */
export interface LeaveConflictNotice {
  employeeId: number;
  date: Date;
  leaveApplicationId: number;
}

/**
 * Tell HR a punch landed on an approved leave day (event LEAVE_CONFLICT,
 * recipients ROLE:hr-admin). Called by the sync / import paths AFTER their
 * write loop, once per newly recorded conflict.
 */
export async function notifyLeaveConflict(companyId: number, c: LeaveConflictNotice): Promise<void> {
  await notifyEssRequest({
    companyId,
    kind: 'LEAVE',
    action: 'CONFLICT',
    employeeId: c.employeeId,
    requestId: c.leaveApplicationId,
    period: formatPeriod(c.date),
    reason: 'Attendance punched on an approved leave day',
    linkPath: '/approvals/workforce/leave-conflicts',
  });
}
