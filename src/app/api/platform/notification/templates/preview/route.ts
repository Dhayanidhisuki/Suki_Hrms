/**
 * POST /api/platform/notification/templates/preview (platform.notification.admin)
 *   Render a stored template (templateId) or ad-hoc text against a sample
 *   context. Employee/Requester/Recipient/Company/System/Link are resolved
 *   the same way notify() does; everything else comes from sampleContext.
 *   → { subject, body, unresolved }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { ntfPreviewSchema } from '@/lib/validations/platform-notification';
import { badRequest } from '@/lib/platform/notification/http';
import { buildRenderContext, renderForChannel } from '@/lib/platform/notification/service';
import { loadEmployeeInfo } from '@/lib/platform/notification/recipients';

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'platform.notification.admin');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = ntfPreviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());
  const body = parsed.data;

  let tpl: { subject: string | null; bodyText: string; bodyHtml: string | null; smsText: string | null };
  let channel: string = body.channel ?? 'INAPP';
  if (body.templateId) {
    const row = await prisma.notificationTemplate.findFirst({ where: { id: body.templateId, companyId: scope.companyId } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    tpl = {
      subject: body.subject !== undefined ? body.subject : row.subject,
      bodyText: body.bodyText ?? row.bodyText,
      bodyHtml: body.bodyHtml !== undefined ? body.bodyHtml : row.bodyHtml,
      smsText: body.smsText !== undefined ? body.smsText : row.smsText,
    };
    channel = body.channel ?? row.channel;
  } else {
    tpl = { subject: body.subject ?? null, bodyText: body.bodyText ?? '', bodyHtml: body.bodyHtml ?? null, smsText: body.smsText ?? null };
  }

  const ids = [body.subjectEmpId, body.requesterEmpId, body.recipientEmpId].filter((n): n is number => typeof n === 'number');
  const [company, people] = await Promise.all([
    prisma.company.findUnique({ where: { id: scope.companyId }, select: { id: true, code: true, name: true } }),
    loadEmployeeInfo(scope.companyId, ids),
  ]);
  const ctx = buildRenderContext({
    company,
    subject: body.subjectEmpId ? people.get(body.subjectEmpId) ?? null : null,
    requester: body.requesterEmpId ? people.get(body.requesterEmpId) ?? null : null,
    recipient: body.recipientEmpId ? people.get(body.recipientEmpId) ?? null : null,
    ctx: { linkPath: body.linkPath, data: body.sampleContext },
  });
  const out = renderForChannel(tpl, channel, ctx);
  return NextResponse.json({ subject: out.subject, body: out.body, unresolved: out.unresolved, channel });
}
