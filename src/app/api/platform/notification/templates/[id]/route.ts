/**
 * GET /api/platform/notification/templates/[id] — one version (platform.notification.view)
 * PUT /api/platform/notification/templates/[id] — edit (platform.notification.admin)
 *   An Active version that already has deliveries is immutable (§12.3: a
 *   sent message must keep saying what it said): the edit becomes a new
 *   version instead. Otherwise the row is updated in place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { ntfTemplateUpdateSchema } from '@/lib/validations/platform-notification';
import { badRequest, callerUserId, createTemplateVersion, utcDate, validateTemplatePlaceholders } from '@/lib/platform/notification/http';

async function load(request: NextRequest, params: Promise<{ id: string }>) {
  const scope = getCompanyId(request);
  if ('error' in scope) return { error: scope.error };
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { error: badRequest('Invalid id') };
  const row = await prisma.notificationTemplate.findFirst({ where: { id, companyId: scope.companyId } });
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { scope, row };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.view');
  if (permErr) return permErr;
  const r = await load(request, params);
  if ('error' in r) return r.error;
  const deliveries = await prisma.notificationDelivery.count({ where: { templateId: r.row.id } });
  return NextResponse.json({ ...r.row, deliveryCount: deliveries });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const r = await load(request, params);
  if ('error' in r) return r.error;
  const { scope, row } = r;

  const parsed = ntfTemplateUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const { versionNote: _versionNote, ...patch } = parsed.data;
  void _versionNote;

  const merged = {
    name: patch.name ?? row.name,
    subject: patch.subject !== undefined ? patch.subject : row.subject,
    bodyHtml: patch.bodyHtml !== undefined ? patch.bodyHtml : row.bodyHtml,
    bodyText: patch.bodyText ?? row.bodyText,
    smsText: patch.smsText !== undefined ? patch.smsText : row.smsText,
    designationFilter: patch.designationFilter !== undefined ? patch.designationFilter : row.designationFilter,
    departmentFilter: patch.departmentFilter !== undefined ? patch.departmentFilter : row.departmentFilter,
    status: patch.status ?? row.status,
    effectiveFrom: patch.effectiveFrom ? utcDate(patch.effectiveFrom) : row.effectiveFrom,
    effectiveTo: patch.effectiveTo !== undefined ? (patch.effectiveTo ? utcDate(patch.effectiveTo) : null) : row.effectiveTo,
  };
  if ((row.channel === 'EMAIL' || row.channel === 'INAPP') && !merged.subject?.trim()) return badRequest('subject is mandatory for EMAIL and INAPP templates');
  if (row.channel === 'SMS' && !merged.smsText?.trim()) return badRequest('smsText is mandatory for SMS templates');
  if (merged.effectiveTo && merged.effectiveTo.getTime() < merged.effectiveFrom.getTime()) return badRequest('effectiveTo must not precede effectiveFrom');

  const event = await prisma.notificationEvent.findFirst({ where: { companyId: scope.companyId, code: row.eventCode }, select: { contextSchemaJson: true } });
  const placeholderErrors = validateTemplatePlaceholders(merged, event?.contextSchemaJson);
  if (placeholderErrors.length) return badRequest('Template validation failed', placeholderErrors);

  const actor = { userId: callerUserId(request) };
  const contentChanged =
    merged.subject !== row.subject || merged.bodyHtml !== row.bodyHtml || merged.bodyText !== row.bodyText || merged.smsText !== row.smsText ||
    merged.designationFilter !== row.designationFilter || merged.departmentFilter !== row.departmentFilter;
  const hasDeliveries = row.status === 'Active' && (await prisma.notificationDelivery.count({ where: { templateId: row.id } })) > 0;

  if (hasDeliveries && contentChanged) {
    const latest = await prisma.notificationTemplate.findFirst({ where: { companyId: scope.companyId, code: row.code }, orderBy: { versionNo: 'desc' }, select: { id: true } });
    if (latest && latest.id !== row.id) return NextResponse.json({ error: 'Only the latest version can be revised; edit that version instead' }, { status: 409 });
    // A new version starts today unless the caller moved effectiveFrom forward.
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const from = patch.effectiveFrom ? merged.effectiveFrom : todayUtc;
    const { created, closed } = await createTemplateVersion({
      companyId: scope.companyId,
      code: row.code,
      name: merged.name,
      eventCode: row.eventCode,
      channel: row.channel,
      language: row.language,
      effectiveFrom: from,
      effectiveTo: patch.effectiveTo !== undefined ? merged.effectiveTo : null,
      subject: merged.subject,
      bodyHtml: merged.bodyHtml,
      bodyText: merged.bodyText,
      smsText: merged.smsText,
      designationFilter: merged.designationFilter,
      departmentFilter: merged.departmentFilter,
      status: merged.status,
      createdByUserId: actor.userId,
    });
    await audit({ companyId: scope.companyId, entityType: 'NotificationTemplate', entityId: created.id, entityRef: `${created.code}@v${created.versionNo}`, action: 'NEW_VERSION', actor, before: closed ?? row, after: created, remark: 'Edit of an Active template with deliveries; new version created' });
    return NextResponse.json({ ...created, versioned: true, previousVersionId: row.id });
  }

  const updated = await prisma.notificationTemplate.update({ where: { id: row.id }, data: merged });
  await audit({ companyId: scope.companyId, entityType: 'NotificationTemplate', entityId: updated.id, entityRef: `${updated.code}@v${updated.versionNo}`, action: 'UPDATE', actor, before: row, after: updated });
  return NextResponse.json({ ...updated, versioned: false });
}
