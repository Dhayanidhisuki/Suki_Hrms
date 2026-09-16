/**
 * Outbox dispatcher (BRD §14.1, §14.3).
 *
 * dispatchPending() claims Queued / SoftBounced rows whose nextAttemptAt is
 * null or past, hands each to its channel transport and records the
 * outcome: Sent (+gatewayMessageId), SoftBounced with the per-channel
 * backoff, or HardBounced on a permanent failure. When retries are
 * exhausted or the failure is permanent the message falls back to INAPP
 * (an inbox row is written and a Delivered INAPP delivery is recorded).
 * Rows past expiresAt are marked Expired without an attempt.
 *
 * startNotificationDispatcher() runs it every 30 s, guarded on globalThis
 * so dev HMR never starts a second timer, and never overlapping itself.
 * It is started from src/instrumentation.ts (wired by the platform owner).
 */

import { prisma } from '@/lib/prisma';
import { createInAppRow } from './inapp';
import { getTransport, type DeliveryRow, type TransportResult } from './transport';

/** Attempt schedule in minutes, index = attemptCount before the attempt (§14.3). */
export const BACKOFF_MINUTES: Record<string, number[]> = {
  EMAIL: [0, 2, 15, 60],
  SMS: [0, 5, 30],
  PUSH: [0, 1, 10],
  INAPP: [0, 1],
};

const GATEWAY_TIMEOUT_MS: Record<string, number> = { EMAIL: 30_000, SMS: 20_000, PUSH: 10_000, INAPP: 5_000 };

export type DispatchSummary = { attempted: number; sent: number; failed: number };

function maxAttempts(channel: string): number {
  return (BACKOFF_MINUTES[channel] ?? BACKOFF_MINUTES.EMAIL).length;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`gateway timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Terminal fallback to INAPP for an EMAIL/SMS/PUSH row (§14.3 table). */
async function fallbackToInApp(d: DeliveryRow, reason: string): Promise<void> {
  const isEmployee = d.recipientType === 'EMPLOYEE';
  const isUser = d.recipientType === 'USER';
  if (!isEmployee && !isUser) return; // EXTERNAL has no inbox

  // Don't duplicate an in-app message that notify() already delivered for this event instance.
  const already = await prisma.notificationDelivery.findFirst({
    where: {
      companyId: d.companyId,
      eventInstanceId: d.eventInstanceId ?? '__none__',
      channel: 'INAPP',
      recipientType: d.recipientType,
      recipientId: d.recipientId,
      status: { in: ['Delivered', 'Read'] },
    },
    select: { id: true },
  });
  if (already) return;

  const now = new Date();
  const row = await prisma.notificationDelivery.create({
    data: {
      companyId: d.companyId,
      correlationId: d.correlationId,
      eventCode: d.eventCode,
      eventInstanceId: d.eventInstanceId,
      moduleCode: d.moduleCode,
      sourceEntityType: d.sourceEntityType,
      sourceEntityId: d.sourceEntityId,
      templateId: d.templateId,
      templateVersionNo: d.templateVersionNo,
      language: d.language,
      channel: 'INAPP',
      recipientType: d.recipientType,
      recipientId: d.recipientId,
      recipientExpression: d.recipientExpression,
      renderedSubject: d.renderedSubject,
      renderedBody: d.renderedBody,
      priority: d.priority,
      status: 'Delivered',
      attemptCount: 1,
      lastAttemptAt: now,
      queuedAt: now,
      sentAt: now,
      deliveredAt: now,
      failureReason: `Fallback from ${d.channel} #${d.id}: ${reason}`.slice(0, 500),
    },
    select: { id: true },
  });
  await createInAppRow({
    companyId: d.companyId,
    deliveryId: row.id,
    recipientUserId: isUser ? d.recipientId : null,
    recipientEmpId: isEmployee ? d.recipientId : null,
    eventCode: d.eventCode,
    title: d.renderedSubject || d.eventCode,
    body: d.renderedBody,
    priority: d.priority,
  });
}

async function attempt(d: DeliveryRow): Promise<'sent' | 'failed' | 'retry'> {
  const now = new Date();
  const attemptNo = d.attemptCount + 1;
  const limit = maxAttempts(d.channel);

  let result: TransportResult;
  if (d.channel === 'INAPP') {
    // A Queued INAPP row (only from external callers; notify() delivers immediately)
    try {
      await createInAppRow({
        companyId: d.companyId,
        deliveryId: d.id,
        recipientUserId: d.recipientType === 'USER' ? d.recipientId : null,
        recipientEmpId: d.recipientType === 'EMPLOYEE' ? d.recipientId : null,
        eventCode: d.eventCode,
        title: d.renderedSubject || d.eventCode,
        body: d.renderedBody,
        priority: d.priority,
      });
      result = { ok: true };
    } catch (err) {
      result = { ok: false, permanent: false, text: (err as Error).message };
    }
  } else {
    try {
      result = await withTimeout(getTransport(d.channel).send(d), GATEWAY_TIMEOUT_MS[d.channel] ?? 30_000);
    } catch (err) {
      result = { ok: false, permanent: false, code: 'EXCEPTION', text: (err as Error).message };
    }
  }

  if (result.ok) {
    const delivered = d.channel === 'INAPP';
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: {
        status: delivered ? 'Delivered' : 'Sent',
        attemptCount: attemptNo,
        lastAttemptAt: now,
        nextAttemptAt: null,
        sentAt: now,
        deliveredAt: delivered ? now : null,
        gatewayMessageId: result.gatewayMessageId?.slice(0, 120) ?? null,
        gatewayResponseCode: 'OK',
        gatewayResponseText: null,
      },
    });
    return 'sent';
  }

  const text = (result.text ?? 'gateway failure').slice(0, 500);
  const code = result.code?.slice(0, 40) ?? null;

  if (result.permanent) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: 'HardBounced', attemptCount: attemptNo, lastAttemptAt: now, nextAttemptAt: null, gatewayResponseCode: code, gatewayResponseText: text, failureReason: `Permanent failure: ${text}`.slice(0, 500) },
    });
    await fallbackToInApp(d, text);
    return 'failed';
  }

  if (attemptNo >= limit) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: 'FailedRetriesExhausted', attemptCount: attemptNo, lastAttemptAt: now, nextAttemptAt: null, gatewayResponseCode: code, gatewayResponseText: text, failureReason: `${limit} attempt(s) failed; last: ${text}`.slice(0, 500) },
    });
    await fallbackToInApp(d, text);
    return 'failed';
  }

  const waitMin = (BACKOFF_MINUTES[d.channel] ?? BACKOFF_MINUTES.EMAIL)[attemptNo] ?? 60;
  await prisma.notificationDelivery.update({
    where: { id: d.id },
    data: { status: 'SoftBounced', attemptCount: attemptNo, lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + waitMin * 60_000), gatewayResponseCode: code, gatewayResponseText: text },
  });
  return 'retry';
}

export async function dispatchPending(companyId?: number, limit = 100): Promise<DispatchSummary> {
  const now = new Date();
  const take = Math.min(Math.max(1, Math.floor(limit)), 1000);
  const scope = companyId ? { companyId } : {};

  // Expire first so a stale row never reaches the gateway.
  await prisma.notificationDelivery.updateMany({
    where: { ...scope, status: { in: ['Queued', 'SoftBounced', 'Deferred'] }, expiresAt: { lt: now } },
    data: { status: 'Expired', failureReason: 'Validity window elapsed before delivery' },
  });

  const candidates = await prisma.notificationDelivery.findMany({
    where: {
      ...scope,
      status: { in: ['Queued', 'SoftBounced'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ priority: 'asc' }, { queuedAt: 'asc' }],
    take,
  });

  const summary: DispatchSummary = { attempted: 0, sent: 0, failed: 0 };
  for (const c of candidates) {
    // Claim: only the worker that flips Queued/SoftBounced → Sending proceeds.
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: c.id, status: { in: ['Queued', 'SoftBounced'] } },
      data: { status: 'Sending' },
    });
    if (claimed.count !== 1) continue;
    summary.attempted++;
    try {
      const r = await attempt({ ...c, status: 'Sending' });
      if (r === 'sent') summary.sent++;
      else if (r === 'failed') summary.failed++;
    } catch (err) {
      console.error(`[notification/dispatch] delivery #${c.id} crashed:`, err);
      await prisma.notificationDelivery
        .update({ where: { id: c.id }, data: { status: 'SoftBounced', attemptCount: c.attemptCount + 1, lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + 5 * 60_000), gatewayResponseText: (err as Error).message?.slice(0, 500) } })
        .catch(() => {});
      summary.failed++;
    }
  }
  return summary;
}

// ── scheduler ─────────────────────────────────────────────────────────────

interface DispatcherState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  intervalMs: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSummary: DispatchSummary | null;
}

const g = globalThis as unknown as { __notificationDispatcher?: DispatcherState };

export function getDispatcherState(): DispatcherState | null {
  return g.__notificationDispatcher ?? null;
}

async function tick(state: DispatcherState): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.lastStartedAt = new Date();
  try {
    const s = await dispatchPending();
    state.lastSummary = s;
    if (s.attempted) console.log(`[notification/dispatch] attempted ${s.attempted}, sent ${s.sent}, failed ${s.failed}`);
  } catch (err) {
    console.error('[notification/dispatch] run crashed', err);
  } finally {
    state.running = false;
    state.lastFinishedAt = new Date();
  }
}

export function startNotificationDispatcher(): void {
  if (g.__notificationDispatcher) return;
  if (process.env.NOTIFICATION_DISPATCH_ENABLED === 'false') {
    console.log('[notification/dispatch] disabled by NOTIFICATION_DISPATCH_ENABLED=false');
    return;
  }
  const raw = Number(process.env.NOTIFICATION_DISPATCH_INTERVAL_MS ?? 30_000);
  const intervalMs = Math.max(5_000, Number.isFinite(raw) && raw > 0 ? raw : 30_000);
  const state: DispatcherState = { timer: null, running: false, intervalMs, lastStartedAt: null, lastFinishedAt: null, lastSummary: null };
  g.__notificationDispatcher = state;
  state.timer = setInterval(() => void tick(state), intervalMs);
  state.timer.unref?.();
  console.log(`[notification/dispatch] started: every ${intervalMs / 1000}s`);
}
