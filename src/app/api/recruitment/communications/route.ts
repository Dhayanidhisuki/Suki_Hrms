/**
 * Communication Log API — list, create (BRD §5.5, §5.21).
 * Records all emails/notifications sent to candidates.
 * GET  /api/recruitment/communications?candidateId=
 * POST /api/recruitment/communications
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { communicationLogSchema } from '@/lib/validations/recruitment';

const include = {
  emailTemplate: { select: { id: true, templateName: true } },
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const where: Record<string, unknown> = {};
  if (candidateId) where.candidateId = parseInt(candidateId);
  const records = await prisma.communicationLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    include,
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = communicationLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const record = await prisma.communicationLog.create({
    data: {
      candidateId: parsed.data.candidateId,
      emailTemplateId: parsed.data.emailTemplateId ?? null,
      eventType: parsed.data.eventType,
      toEmail: parsed.data.toEmail,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: parsed.data.status,
      sentAt: new Date(),
    },
    include,
  });

  return NextResponse.json(record, { status: 201 });
}
