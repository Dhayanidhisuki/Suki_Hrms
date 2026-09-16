/**
 * Integration: notify() → delivery rows + in-app inbox → dispatchPending().
 * Uses an existing KUNAERO employee that has a login (so an email exists).
 * Event/template rows are created only if the seed has not run; every row
 * this file writes is removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/platform/notification/service';
import { dispatchPending } from '@/lib/platform/notification/dispatcher';
import { emitPlatformEvent } from '@/lib/platform/events';

const CORRELATION = `TEST-AUTO-ntf-${Date.now().toString(36)}`;
const CORRELATION_EMIT = `${CORRELATION}-emit`;

let companyId: number;
let employeeId: number;
let userId: number;
const createdEventIds: number[] = [];
const createdTemplateIds: number[] = [];

beforeAll(async () => {
  const company = await prisma.company.findFirst({ where: { code: 'KUNAERO' } });
  if (!company) throw new Error('KUNAERO company missing');
  companyId = company.id;

  const emp = await prisma.employee.findFirst({
    where: { companyId, deletedAt: null, userId: { not: null }, user: { isActive: true, deletedAt: null } },
    select: { id: true, userId: true },
    orderBy: { id: 'asc' },
  });
  if (!emp?.userId) throw new Error('No KUNAERO employee with a linked user');
  employeeId = emp.id;
  userId = emp.userId;

  // Ensure WF_APPROVED is registered with INAPP + EMAIL templates (seed normally does this).
  let event = await prisma.notificationEvent.findFirst({ where: { companyId, code: 'WF_APPROVED' } });
  if (!event) {
    event = await prisma.notificationEvent.create({
      data: { companyId, code: 'WF_APPROVED', name: 'Request approved', moduleCode: 'PLAT', defaultRecipients: 'REQUESTER,SUBJECT_EMPLOYEE' },
    });
    createdEventIds.push(event.id);
  } else if (!event.isActive || !event.inAppEnabled || !event.emailEnabled) {
    throw new Error('WF_APPROVED is registered but INAPP/EMAIL are not both enabled');
  }
  for (const channel of ['INAPP', 'EMAIL']) {
    const exists = await prisma.notificationTemplate.findFirst({ where: { companyId, eventCode: 'WF_APPROVED', channel, status: 'Active' } });
    if (!exists) {
      const t = await prisma.notificationTemplate.create({
        data: {
          companyId,
          code: `TEST_AUTO_WF_APPROVED_${channel}`,
          name: `test ${channel}`,
          eventCode: 'WF_APPROVED',
          channel,
          effectiveFrom: new Date(Date.UTC(2026, 0, 1)),
          subject: 'Approved: {{Request.Title}} ({{Request.No}})',
          bodyText: 'Dear {{Recipient.FirstName}}, {{Request.No}} was approved. {{Link.RequestDetail}}',
        },
      });
      createdTemplateIds.push(t.id);
    }
  }
});

afterAll(async () => {
  const deliveries = await prisma.notificationDelivery.findMany({ where: { correlationId: { startsWith: CORRELATION } }, select: { id: true } });
  const ids = deliveries.map((d) => d.id);
  if (ids.length) await prisma.notificationInApp.deleteMany({ where: { deliveryId: { in: ids } } });
  await prisma.notificationDelivery.deleteMany({ where: { correlationId: { startsWith: CORRELATION } } });
  await prisma.auditLog.deleteMany({ where: { correlationId: { startsWith: CORRELATION } } });
  if (createdTemplateIds.length) await prisma.notificationTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
  if (createdEventIds.length) await prisma.notificationEvent.deleteMany({ where: { id: { in: createdEventIds } } });
});

function inboxRequest(path: string, method = 'GET') {
  return new NextRequest(new URL(path, 'http://localhost'), {
    method,
    headers: new Headers({ 'x-user-id': String(userId), 'x-company-id': String(companyId), 'x-role-id': '1' }),
  });
}

describe('notify()', () => {
  it('WF_APPROVED for SUBJECT_EMPLOYEE writes a Delivered INAPP row + inbox row and a Queued EMAIL row', async () => {
    const { deliveryIds } = await notify(companyId, 'WF_APPROVED', {
      correlationId: CORRELATION,
      moduleCode: 'LEAV',
      subjectEmpId: employeeId,
      requesterEmpId: employeeId,
      recipients: ['SUBJECT_EMPLOYEE'],
      linkPath: '/approvals/inbox/1',
      data: { Request: { No: 'LEAV/2526/00001', Title: 'Casual leave 2 days', Type: 'Leave' }, Approver: { Name: 'Test Approver', Remark: 'OK' } },
    });
    expect(deliveryIds.length).toBeGreaterThanOrEqual(2);

    const rows = await prisma.notificationDelivery.findMany({ where: { id: { in: deliveryIds } } });
    const inapp = rows.find((r) => r.channel === 'INAPP');
    const email = rows.find((r) => r.channel === 'EMAIL');
    expect(inapp?.status).toBe('Delivered');
    expect(inapp?.recipientId).toBe(employeeId);
    expect(inapp?.renderedSubject).toContain('LEAV/2526/00001');
    expect(email?.status).toBe('Queued');
    expect(email?.recipientAddress).toMatch(/@/);
    expect(email?.templateId).toBeTruthy();
    // Every recipient de-duplicates to exactly one row per channel.
    expect(rows.filter((r) => r.channel === 'INAPP')).toHaveLength(1);

    const inbox = await prisma.notificationInApp.findFirst({ where: { deliveryId: inapp!.id } });
    expect(inbox?.recipientEmpId).toBe(employeeId);
    expect(inbox?.linkPath).toBe('/approvals/inbox/1');
    expect(inbox?.isRead).toBe(false);

    const auditRows = await prisma.auditLog.findMany({ where: { correlationId: CORRELATION, entityType: 'NotificationEvent', action: 'RAISED' } });
    expect(auditRows).toHaveLength(1);
  });

  it('the in-app row is visible through the inbox route and can be marked read', async () => {
    const { GET } = await import('@/app/api/platform/notification/inbox/route');
    const res = await GET(inboxRequest('/api/platform/notification/inbox?unread=1&limit=100'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: number; eventCode: string; title: string; deliveryId: number }[]; unreadCount: number };
    const ours = body.data.find((m) => m.title.includes('LEAV/2526/00001'));
    expect(ours).toBeTruthy();
    expect(body.unreadCount).toBeGreaterThanOrEqual(1);

    const { POST } = await import('@/app/api/platform/notification/inbox/[id]/read/route');
    const read = await POST(inboxRequest(`/api/platform/notification/inbox/${ours!.id}/read`, 'POST'), { params: Promise.resolve({ id: String(ours!.id) }) });
    expect(read.status).toBe(200);
    const after = await prisma.notificationInApp.findUnique({ where: { id: ours!.id } });
    expect(after?.isRead).toBe(true);
    const delivery = await prisma.notificationDelivery.findUnique({ where: { id: ours!.deliveryId } });
    expect(delivery?.status).toBe('Read');
  });

  it('dispatchPending() with ConsoleTransport moves the EMAIL row to Sent', async () => {
    const summary = await dispatchPending(companyId, 500);
    expect(summary.attempted).toBeGreaterThanOrEqual(1);
    const email = await prisma.notificationDelivery.findFirst({ where: { correlationId: CORRELATION, channel: 'EMAIL' } });
    expect(email?.status).toBe('Sent');
    expect(email?.gatewayMessageId).toBeTruthy();
    expect(email?.attemptCount).toBe(1);
  });

  it('unknown event returns empty without throwing', async () => {
    await expect(notify(companyId, 'NO_SUCH_EVENT_TEST_AUTO', { correlationId: `${CORRELATION}-unknown` })).resolves.toEqual({ deliveryIds: [] });
  });

  it('reaches the service through emitPlatformEvent (subscriber wired)', async () => {
    await emitPlatformEvent(companyId, 'WF_APPROVED', {
      correlationId: CORRELATION_EMIT,
      subjectEmpId: employeeId,
      recipients: ['SUBJECT_EMPLOYEE'],
      data: { Request: { No: 'LEAV/2526/00002', Title: 'Via event bus' } },
    });
    const rows = await prisma.notificationDelivery.findMany({ where: { correlationId: CORRELATION_EMIT } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
