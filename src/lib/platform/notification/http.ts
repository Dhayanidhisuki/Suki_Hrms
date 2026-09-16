/**
 * Small helpers shared by the notification API routes: caller identity,
 * template design-time validation, versioning. Route files stay thin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type NotificationTemplate } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractPlaceholders } from './render';
import { SERVICE_NAMESPACES } from './service';

export const MAX_PLACEHOLDERS = 40;

export function callerUserId(request: NextRequest): number | null {
  const raw = request.headers.get('x-user-id');
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function callerEmployeeId(userId: number, companyId: number): Promise<number | null> {
  const emp = await prisma.employee.findFirst({ where: { userId, companyId, deletedAt: null }, select: { id: true } });
  return emp?.id ?? null;
}

export function badRequest(error: string, details?: unknown, status = 400) {
  return NextResponse.json(details !== undefined ? { error, details } : { error }, { status });
}

export function utcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dayBefore(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1));
}

/**
 * Design-time template validation (§12.6 rules 5 and 8): placeholders must
 * parse, count ≤ 40, and every namespace must be one the service resolves or
 * one the event's contextSchemaJson declares (when it declares any).
 */
export function validateTemplatePlaceholders(
  fields: { subject?: string | null; bodyText?: string | null; bodyHtml?: string | null; smsText?: string | null },
  contextSchemaJson: string | null | undefined,
): string[] {
  const errors: string[] = [];
  const all = [fields.subject, fields.bodyText, fields.bodyHtml, fields.smsText].filter((s): s is string => !!s).map(extractPlaceholders).flat();
  const distinct = new Set(all.map((p) => `${p.namespace}.${p.field}`));
  if (distinct.size > MAX_PLACEHOLDERS) errors.push(`Template uses ${distinct.size} distinct placeholders; the limit is ${MAX_PLACEHOLDERS}`);

  let declared: Set<string> | null = null;
  if (contextSchemaJson) {
    try {
      const parsed = JSON.parse(contextSchemaJson) as Record<string, unknown>;
      const ns = Object.keys(parsed).filter((k) => k !== 'optional' && parsed[k] && typeof parsed[k] === 'object');
      if (ns.length) declared = new Set(ns);
    } catch {
      /* unparsable schema: skip namespace check */
    }
  }
  if (declared) {
    const allowed = new Set<string>([...SERVICE_NAMESPACES, ...declared]);
    for (const p of distinct) {
      const ns = p.split('.')[0];
      if (!allowed.has(ns)) errors.push(`Placeholder {{${p}}} uses namespace '${ns}' which the event does not supply`);
    }
  }
  return errors;
}

export type TemplateVersionInput = Omit<Prisma.NotificationTemplateUncheckedCreateInput, 'id' | 'versionNo' | 'createdAt' | 'updatedAt'>;

/**
 * Create a template row. When a row with the same (companyId, code) exists the
 * new row gets versionNo+1 and the previous latest version is closed the day
 * before the new effectiveFrom. Runs in one transaction.
 */
export async function createTemplateVersion(input: TemplateVersionInput): Promise<{ created: NotificationTemplate; closed: NotificationTemplate | null }> {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.notificationTemplate.findFirst({
      where: { companyId: input.companyId, code: input.code },
      orderBy: { versionNo: 'desc' },
    });
    const versionNo = (latest?.versionNo ?? 0) + 1;
    let closed: NotificationTemplate | null = null;
    if (latest) {
      const from = input.effectiveFrom instanceof Date ? input.effectiveFrom : new Date(input.effectiveFrom);
      const cutoff = dayBefore(from);
      if (!latest.effectiveTo || latest.effectiveTo.getTime() > cutoff.getTime()) {
        closed = await tx.notificationTemplate.update({ where: { id: latest.id }, data: { effectiveTo: cutoff } });
      }
    }
    const created = await tx.notificationTemplate.create({ data: { ...input, versionNo } });
    return { created, closed };
  });
}
