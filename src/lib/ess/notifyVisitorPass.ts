/**
 * Fire-and-forget notifications for the visitor gate-pass journey.
 *
 * Kept separate from notifyEssRequest because a visitor pass does not have the
 * shape of an employee request. Its subject is an external visitor with no
 * employee record, and the two employees involved play different roles:
 *
 *   subject   = the HOST (personToMeetId) — who approves the visit
 *   requester = whoever raised the pass (createdBy) — who is told the outcome
 *
 * Mapping them that way is what lets the recipient rules seeded by
 * scripts/seed-visitor-notification-events.mjs address the right person: the
 * host on SUBMITTED, the raiser on APPROVED/REJECTED.
 *
 * This runs ALONGSIDE notifyVisitorEvent(), which is a different thing despite
 * the similar name: that one appends to VisitorNotificationLog, an in-app-only
 * table read by the visitor module's own notifications page, and nothing ever
 * dispatches its PENDING rows. This one goes through the platform engine, so it
 * renders templates and actually delivers email. Neither was removed — the log
 * still backs an existing screen.
 */

import { notify } from '@/lib/platform/notification/service';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export type VisitorPassAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface VisitorPassNotifyOptions {
  companyId: number;
  action: VisitorPassAction;
  /** The gate pass row — only the fields the templates read. */
  pass: {
    id: number;
    gatePassNo: string;
    visitorName: string;
    visitDate: Date;
    personToMeetId: number;
    createdBy: number | null;
    purposeValue?: string | null;
  };
  /** Host's display name, when the caller already loaded it. */
  hostName?: string | null;
  /** Rejection reason, on a REJECTED event. */
  reason?: string | null;
}

export async function notifyVisitorPass(opts: VisitorPassNotifyOptions): Promise<void> {
  const eventCode = `VISITOR_PASS_${opts.action}`;
  try {
    // createdBy is a userId; the recipient rules work in employee ids.
    const requesterEmpId = opts.pass.createdBy
      ? await resolveOwnEmployeeId(opts.pass.createdBy)
      : null;

    await notify(opts.companyId, eventCode, {
      subjectEmpId: opts.pass.personToMeetId,
      requesterEmpId: requesterEmpId ?? undefined,
      sourceEntityType: 'VISITOR_PASS',
      sourceEntityId: opts.pass.id,
      linkPath: `/visitor/gate-passes/${opts.pass.id}`,
      data: {
        Visitor: {
          Name: opts.pass.visitorName,
          PassNo: opts.pass.gatePassNo,
          Host: opts.hostName ?? '',
          Date: opts.pass.visitDate.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          Purpose: opts.pass.purposeValue ?? '',
          Reason: opts.reason ?? '',
        },
      },
    });
  } catch (err) {
    // Deliberately not rethrown: a notification must never fail the approval.
    console.error(`[visitor-notify] ${eventCode} failed for pass ${opts.pass.id}`, err);
  }
}
