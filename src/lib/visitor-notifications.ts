import { prisma } from '@/lib/prisma';

export type VisitorNotificationEvent =
  | 'VISITOR_SUBMITTED'
  | 'VISITOR_APPROVED'
  | 'VISITOR_REJECTED'
  | 'VISITOR_CHECKED_IN'
  | 'VISITOR_CHECKED_OUT'
  | 'VISITOR_OVERDUE'
  | 'GNR_CREATED'
  | 'GNR_AUTHORIZED'
  | 'GNR_INWARD'
  | 'GNR_OUTWARD';

interface NotifyOptions {
  companyId: number;
  event: VisitorNotificationEvent;
  recipients: { channel?: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP'; address: string }[];
  subject?: string;
  body?: string;
  visitorGatePassId?: number;
  gnrId?: number;
}

const EVENT_TITLES: Record<VisitorNotificationEvent, string> = {
  VISITOR_SUBMITTED: 'Visitor request submitted for approval',
  VISITOR_APPROVED: 'Visitor request approved',
  VISITOR_REJECTED: 'Visitor request rejected',
  VISITOR_CHECKED_IN: 'Visitor checked in',
  VISITOR_CHECKED_OUT: 'Visitor checked out',
  VISITOR_OVERDUE: 'Visitor overdue',
  GNR_CREATED: 'GNR created',
  GNR_AUTHORIZED: 'GNR authorized',
  GNR_INWARD: 'Material inward recorded',
  GNR_OUTWARD: 'Material outward recorded',
};

export function notifyVisitorEvent({ companyId, event, recipients, subject, body, visitorGatePassId, gnrId }: NotifyOptions) {
  const safeBody = body ?? EVENT_TITLES[event];
  const safeSubject = subject ?? EVENT_TITLES[event];

  const logs = recipients.map((r) => ({
    companyId,
    event,
    channel: r.channel ?? 'IN_APP',
    recipient: r.address,
    subject: safeSubject,
    body: safeBody,
    status: 'PENDING' as const,
    visitorGatePassId,
    gnrId,
  }));

  // Fire-and-forget: do not block the main transaction
  prisma.visitorNotificationLog
    .createMany({ data: logs })
    .catch(() => {});
}
