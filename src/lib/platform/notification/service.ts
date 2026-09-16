/**
 * Notification & Communication service (BRD Parts 12–14).
 *
 * Entry point is notify(): an event arrives (via the platform event bus,
 * see ./subscriber), the registered NotificationEvent decides channels and
 * default recipients, recipients are resolved (§13.2), a template is chosen
 * per recipient × channel (§12.3), rendered (§12.4), and one
 * NotificationDelivery row is written per recipient × channel (§14.6).
 * INAPP is delivered immediately (the inbox row *is* delivery); the other
 * channels are queued for ./dispatcher.
 *
 * Nothing outside src/lib/platform/notification and its API routes imports
 * this file. Modules raise events with emitPlatformEvent().
 */

import { randomUUID } from 'node:crypto';
import type { NotificationEvent, NotificationTemplate } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '../audit/service';
import { SYSTEM_ACTOR, type PlatformEventContext } from '../contracts';
import { createInAppRow } from './inapp';
import { render, type RenderContext } from './render';
import { employeeNamespace, loadEmployeeInfo, resolveRecipients, type EmployeeInfo, type ResolvedRecipient } from './recipients';
import { selectTemplate } from './templates';

export { dispatchPending } from './dispatcher';

export const CHANNELS = ['INAPP', 'EMAIL', 'SMS', 'PUSH'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Default validity window (§14.3 Expired): 72 hours from queuedAt. */
export const DEFAULT_VALIDITY_HOURS = 72;

export const SUPPORT_EMAIL = () => process.env.HRMS_SUPPORT_EMAIL || 'hr@kunaero.in';

/** Namespaces the service resolves itself; everything else must come from ctx.data. */
export const SERVICE_NAMESPACES = ['Employee', 'Recipient', 'Requester', 'Company', 'System', 'Link'] as const;

type CompanyInfo = { id: number; code: string; name: string };

export type NotifyResult = { deliveryIds: number[] };

/** Build the placeholder context for one recipient. Exported for the preview route. */
export function buildRenderContext(input: {
  company: CompanyInfo | null;
  subject: EmployeeInfo | null;
  requester: EmployeeInfo | null;
  recipient: EmployeeInfo | null;
  ctx: PlatformEventContext;
}): RenderContext {
  const data = input.ctx.data ?? {};
  const today = new Date();
  return {
    ...data,
    Employee: { ...employeeNamespace(input.subject), ...(data.Employee ?? {}) },
    Requester: { ...employeeNamespace(input.requester ?? input.subject), ...(data.Requester ?? {}) },
    Recipient: { ...employeeNamespace(input.recipient), ...(data.Recipient ?? {}) },
    Company: {
      Id: input.company?.id,
      Code: input.company?.code,
      Name: input.company?.name,
      HRContact: SUPPORT_EMAIL(),
      ...(data.Company ?? {}),
    },
    System: { Today: today, Now: today, SupportEmail: SUPPORT_EMAIL(), ...(data.System ?? {}) },
    Link: { RequestDetail: input.ctx.linkPath ?? '', ...(data.Link ?? {}) },
  };
}

function maskAddress(address: string | null): string | null {
  if (!address) return null;
  const at = address.indexOf('@');
  if (at > 0) {
    const local = address.slice(0, at);
    const keep = local.slice(0, Math.min(2, local.length));
    return `${keep}${'*'.repeat(Math.max(1, local.length - keep.length))}${address.slice(at)}`;
  }
  return address.length > 4 ? '*'.repeat(address.length - 4) + address.slice(-4) : address;
}

function parseOptionalPlaceholders(event: NotificationEvent): Set<string> {
  if (!event.contextSchemaJson) return new Set();
  try {
    const parsed = JSON.parse(event.contextSchemaJson) as { optional?: unknown };
    if (Array.isArray(parsed?.optional)) return new Set(parsed.optional.filter((s): s is string => typeof s === 'string'));
  } catch {
    /* malformed schema is a config problem, not a send problem */
  }
  return new Set();
}

function enabledChannels(event: NotificationEvent): Channel[] {
  const out: Channel[] = [];
  if (event.inAppEnabled) out.push('INAPP');
  if (event.emailEnabled) out.push('EMAIL');
  if (event.smsEnabled) out.push('SMS');
  if (event.pushEnabled) out.push('PUSH');
  return out;
}

/** Which template fields form subject/body for a channel. */
export function renderForChannel(
  tpl: Pick<NotificationTemplate, 'subject' | 'bodyText' | 'bodyHtml' | 'smsText'>,
  channel: string,
  ctx: RenderContext,
): { subject: string | null; body: string; unresolved: string[] } {
  const unresolved = new Set<string>();
  let subject: string | null = null;
  let body = '';
  if (channel === 'SMS') {
    const r = render(tpl.smsText ?? tpl.bodyText, ctx);
    body = r.text;
    r.unresolved.forEach((u) => unresolved.add(u));
  } else if (channel === 'EMAIL' && tpl.bodyHtml) {
    const s = render(tpl.subject ?? '', ctx);
    const b = render(tpl.bodyHtml, ctx, { escapeHtml: true });
    subject = s.text;
    body = b.text;
    [...s.unresolved, ...b.unresolved].forEach((u) => unresolved.add(u));
  } else {
    const s = render(tpl.subject ?? '', ctx);
    const b = render(tpl.bodyText, ctx);
    subject = s.text;
    body = b.text;
    [...s.unresolved, ...b.unresolved].forEach((u) => unresolved.add(u));
  }
  return { subject, body, unresolved: [...unresolved] };
}

export async function notify(companyId: number, eventCode: string, ctx: PlatformEventContext): Promise<NotifyResult> {
  const event = await prisma.notificationEvent.findFirst({ where: { companyId, code: eventCode } });
  if (!event || !event.isActive) {
    console.warn(`[notification] event ${eventCode} is ${event ? 'inactive' : 'not registered'} for company ${companyId}; nothing sent`);
    return { deliveryIds: [] };
  }

  const correlationId = (ctx.correlationId ?? `ntf-${randomUUID()}`).slice(0, 60);
  const channels = enabledChannels(event);
  const priority = ctx.priority ?? event.defaultPriority ?? 'NORMAL';
  const optional = parseOptionalPlaceholders(event);
  const allowPersonalEmail = event.category === 'STATUTORY';

  const expressions = [
    ...(ctx.recipients ?? []),
    ...(event.defaultRecipients ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ];
  const recipients = await resolveRecipients(companyId, expressions, ctx, { allowPersonalEmail });

  const [company, templates, people] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, code: true, name: true } }),
    prisma.notificationTemplate.findMany({ where: { companyId, eventCode, status: 'Active' } }),
    loadEmployeeInfo(companyId, [ctx.subjectEmpId, ctx.requesterEmpId].filter((n): n is number => typeof n === 'number'), { allowPersonalEmail }),
  ]);
  const subject = ctx.subjectEmpId ? people.get(ctx.subjectEmpId) ?? null : null;
  const requester = ctx.requesterEmpId ? people.get(ctx.requesterEmpId) ?? null : null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_VALIDITY_HOURS * 3600 * 1000);
  const deliveryIds: number[] = [];
  const outcome: Record<string, number> = {};
  const bump = (status: string) => (outcome[status] = (outcome[status] ?? 0) + 1);

  const base = {
    companyId,
    correlationId,
    eventCode,
    eventInstanceId: correlationId,
    moduleCode: ctx.moduleCode ?? event.moduleCode,
    sourceEntityType: ctx.sourceEntityType ?? null,
    sourceEntityId: ctx.sourceEntityId ?? null,
    priority,
    queuedAt: now,
    expiresAt,
  };

  for (const r of recipients) {
    const renderCtx = buildRenderContext({ company, subject, requester, recipient: r.info, ctx });
    for (const channel of channels) {
      const address = addressFor(r, channel);
      if (address.skip) continue;

      const recipient = {
        recipientType: r.type,
        recipientId: r.employeeId ?? r.userId ?? null,
        recipientAddress: address.value,
        recipientAddressMasked: maskAddress(address.value),
        recipientExpression: r.expression.slice(0, 60),
      };

      const tpl = selectTemplate(templates, {
        eventCode,
        channel,
        recipient: r.info ? { designation: r.info.designation, designationCode: r.info.designationCode, department: r.info.department, departmentCode: r.info.departmentCode } : null,
        at: now,
      });
      if (!tpl) {
        const row = await prisma.notificationDelivery.create({
          data: { ...base, ...recipient, channel, status: 'FailedNoTemplate', failureReason: `No active ${channel} template for ${eventCode}` },
          select: { id: true },
        });
        deliveryIds.push(row.id);
        bump('FailedNoTemplate');
        continue;
      }

      const rendered = renderForChannel(tpl, channel, renderCtx);
      const tplFields = { templateId: tpl.id, templateVersionNo: tpl.versionNo, language: tpl.language };
      // A missing deep link must never block a message: the Link namespace is
      // optional by policy, whatever the template says. Everything else is
      // mandatory unless the template gives it a |default:.
      const mandatoryMissing = rendered.unresolved.filter((p) => !optional.has(p) && !p.startsWith('Link.'));
      if (mandatoryMissing.length) {
        const row = await prisma.notificationDelivery.create({
          data: {
            ...base, ...recipient, ...tplFields, channel,
            status: 'FailedUnresolvedPlaceholder',
            failureReason: `Unresolved placeholder(s): ${mandatoryMissing.join(', ')}`.slice(0, 500),
          },
          select: { id: true },
        });
        deliveryIds.push(row.id);
        bump('FailedUnresolvedPlaceholder');
        continue;
      }
      if (rendered.unresolved.length) {
        console.warn(`[notification] ${eventCode}/${channel}: optional placeholder(s) empty: ${rendered.unresolved.join(', ')}`);
      }

      if (address.value === null && channel !== 'INAPP') {
        const row = await prisma.notificationDelivery.create({
          data: {
            ...base, ...recipient, ...tplFields, channel,
            renderedSubject: rendered.subject?.slice(0, 300) ?? null,
            renderedBody: rendered.body,
            status: 'SuppressedNoAddress',
            failureReason: address.reason ?? `No ${channel} address for recipient`,
          },
          select: { id: true },
        });
        deliveryIds.push(row.id);
        bump('SuppressedNoAddress');
        continue;
      }

      const row = await prisma.notificationDelivery.create({
        data: {
          ...base, ...recipient, ...tplFields, channel,
          renderedSubject: rendered.subject?.slice(0, 300) ?? null,
          renderedBody: rendered.body,
          status: 'Queued',
        },
        select: { id: true },
      });
      deliveryIds.push(row.id);

      if (channel === 'INAPP') {
        await createInAppRow({
          companyId,
          deliveryId: row.id,
          recipientUserId: r.userId,
          recipientEmpId: r.employeeId,
          eventCode,
          title: rendered.subject || event.name,
          body: rendered.body,
          linkPath: ctx.linkPath ?? null,
          priority,
        });
        await prisma.notificationDelivery.update({
          where: { id: row.id },
          data: { status: 'Delivered', attemptCount: 1, lastAttemptAt: now, sentAt: now, deliveredAt: now },
        });
        bump('Delivered');
      } else {
        bump('Queued');
      }
    }
  }

  await audit({
    companyId,
    entityType: 'NotificationEvent',
    entityId: event.id,
    entityRef: eventCode,
    action: 'RAISED',
    actor: SYSTEM_ACTOR,
    after: {
      eventCode,
      recipients: recipients.map((r) => ({ key: r.key, expression: r.expression })),
      channels,
      deliveryIds,
      outcome,
      sourceEntityType: ctx.sourceEntityType ?? null,
      sourceEntityId: ctx.sourceEntityId ?? null,
      requestId: ctx.requestId ?? null,
    },
    remark: `${deliveryIds.length} delivery row(s) for ${recipients.length} recipient(s)`,
    correlationId,
  });

  return { deliveryIds };
}

function addressFor(r: ResolvedRecipient, channel: Channel): { skip: boolean; value: string | null; reason?: string } {
  switch (channel) {
    case 'INAPP':
      // An external address has no inbox; nothing to record.
      if (!r.employeeId && !r.userId) return { skip: true, value: null };
      return { skip: false, value: null };
    case 'EMAIL':
      return { skip: false, value: r.email, reason: r.email ? undefined : 'No official or login email on record' };
    case 'SMS':
      if (r.type === 'EXTERNAL') return { skip: true, value: null };
      return { skip: false, value: r.mobile, reason: r.mobile ? undefined : 'No mobile number on record' };
    case 'PUSH':
      if (r.type === 'EXTERNAL') return { skip: true, value: null };
      // No device registration store exists yet; recorded as suppressed, not silently dropped (§14.5).
      return { skip: false, value: null, reason: 'No device registration on record' };
  }
}
