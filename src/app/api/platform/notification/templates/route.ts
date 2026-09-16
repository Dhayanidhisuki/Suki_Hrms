/**
 * GET  /api/platform/notification/templates — list (platform.notification.view)
 *   ?eventCode= ?channel= ?status= ?allVersions=1 (default: latest version per code)
 * POST /api/platform/notification/templates — create (platform.notification.admin)
 *   Same code again = a new version: versionNo+1, previous version's
 *   effectiveTo set to the day before the new effectiveFrom.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { audit } from '@/lib/platform/audit/service';
import { ntfTemplateCreateSchema, ntfTemplateQuerySchema } from '@/lib/validations/platform-notification';
import { badRequest, callerUserId, createTemplateVersion, utcDate, validateTemplatePlaceholders } from '@/lib/platform/notification/http';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfTemplateQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const q = parsed.data;
  const rows = await prisma.notificationTemplate.findMany({
    where: {
      companyId: scope.companyId,
      ...(q.eventCode ? { eventCode: q.eventCode } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.status ? { status: q.status } : {}),
    },
    orderBy: [{ eventCode: 'asc' }, { channel: 'asc' }, { code: 'asc' }, { versionNo: 'desc' }],
  });
  const allVersions = q.allVersions === '1' || q.allVersions === 'true';
  const data = allVersions ? rows : rows.filter((r, i, arr) => i === 0 || arr[i - 1].code !== r.code);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfTemplateCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const body = parsed.data;

  const event = await prisma.notificationEvent.findFirst({ where: { companyId: scope.companyId, code: body.eventCode } });
  if (!event) return badRequest(`Event ${body.eventCode} is not registered for this company`);

  const placeholderErrors = validateTemplatePlaceholders(body, event.contextSchemaJson);
  if (placeholderErrors.length) return badRequest('Template validation failed', placeholderErrors);

  const effectiveFrom = utcDate(body.effectiveFrom);
  const effectiveTo = body.effectiveTo ? utcDate(body.effectiveTo) : null;
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) return badRequest('effectiveTo must not precede effectiveFrom');

  // The same code must stay on the same event/channel/language across versions.
  const sibling = await prisma.notificationTemplate.findFirst({ where: { companyId: scope.companyId, code: body.code }, orderBy: { versionNo: 'desc' } });
  if (sibling && (sibling.eventCode !== body.eventCode || sibling.channel !== body.channel || sibling.language !== body.language)) {
    return NextResponse.json({ error: `Template code ${body.code} belongs to ${sibling.eventCode}/${sibling.channel}/${sibling.language}` }, { status: 409 });
  }

  const { created, closed } = await createTemplateVersion({
    companyId: scope.companyId,
    code: body.code,
    name: body.name,
    eventCode: body.eventCode,
    channel: body.channel,
    language: body.language,
    effectiveFrom,
    effectiveTo,
    subject: body.subject ?? null,
    bodyHtml: body.bodyHtml ?? null,
    bodyText: body.bodyText,
    smsText: body.smsText ?? null,
    designationFilter: body.designationFilter ?? null,
    departmentFilter: body.departmentFilter ?? null,
    status: body.status,
    createdByUserId: callerUserId(request),
  });
  await audit({
    companyId: scope.companyId,
    entityType: 'NotificationTemplate',
    entityId: created.id,
    entityRef: `${created.code}@v${created.versionNo}`,
    action: closed ? 'NEW_VERSION' : 'CREATE',
    actor: { userId: callerUserId(request) },
    before: closed ?? undefined,
    after: created,
  });
  return NextResponse.json(created, { status: 201 });
}
