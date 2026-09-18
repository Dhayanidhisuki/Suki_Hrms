/**
 * Public Candidate Portal API (BRD §10.6).
 * Token-based, no login required. All endpoints verify the token first.
 *
 * GET  /api/portal?t=<token>                     — candidate profile + status + interview + offer + joining
 * GET  /api/portal/messages?t=<token>             — list messages
 * POST /api/portal/messages?t=<token>             — candidate sends a message to HR
 * GET  /api/portal/documents?t=<token>            — list candidate documents
 * POST /api/portal/documents?t=<token>            — candidate uploads a document
 * POST /api/portal/offer?t=<token>&action=accept  — accept/reject offer
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { portalMessageSchema, portalDocumentUploadSchema } from '@/lib/validations/recruitment';

async function verifyToken(request: NextRequest): Promise<{ ok: true; candidateId: number } | { ok: false; response: NextResponse }> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');
  if (!token) return { ok: false, response: NextResponse.json({ error: 'Token required' }, { status: 401 }) };

  const record = await prisma.candidatePortalToken.findUnique({
    where: { token },
    include: { candidate: { select: { id: true, currentStatus: { select: { statusCode: true } } } } },
  });
  if (!record) return { ok: false, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  if (record.revokedAt) return { ok: false, response: NextResponse.json({ error: 'Link revoked' }, { status: 401 }) };
  if (record.expiresAt < new Date()) return { ok: false, response: NextResponse.json({ error: 'Link expired' }, { status: 401 }) };

  // Auto-revoke if candidate joined or rejected (BRD: link expires after joining or rejection)
  const statusCode = record.candidate.currentStatus?.statusCode;
  if (statusCode === 'JOINED' || statusCode === 'REJECTED') {
    return { ok: false, response: NextResponse.json({ error: 'This link is no longer active' }, { status: 403 }) };
  }

  // Update last used
  await prisma.candidatePortalToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, candidateId: record.candidateId };
}

// GET /api/portal?t=<token> — full candidate view
export async function GET(request: NextRequest) {
  const verify = await verifyToken(request);
  if (!verify.ok) return verify.response;
  const candidateId = verify.candidateId;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      currentStatus: { select: { statusCode: true, statusName: true, stageCategory: true, color: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, action: true, fromStatus: true, toStatus: true, createdAt: true, remarks: true } },
      interviewSchedules: {
        include: {
          interviewLevel: { select: { levelName: true } },
          interviewType: { select: { typeName: true } },
          interviewer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { scheduledDate: 'asc' },
      },
      offerLetters: { orderBy: { createdAt: 'desc' }, select: { id: true, offerNo: true, status: true, proposedSalary: true, joiningDate: true, ctc: true, employmentType: true } },
      joining: { select: { id: true, joiningDate: true, joiningStatus: true, actualJoiningDate: true } },
    },
  });

  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  return NextResponse.json({
    candidate: {
      id: candidate.id,
      applicationNo: candidate.applicationNo,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      mobile: candidate.mobile,
      department: candidate.department?.name ?? null,
      designation: candidate.designation?.name ?? null,
      currentStatus: candidate.currentStatus,
    },
    activity: candidate.activityLogs,
    interviews: candidate.interviewSchedules.map((i) => ({
      id: i.id,
      level: i.interviewLevel?.levelName ?? '—',
      type: i.interviewType?.typeName ?? '—',
      date: i.scheduledDate,
      time: i.startTime,
      mode: i.mode,
      status: i.status,
      interviewer: i.interviewer ? `${i.interviewer.firstName} ${i.interviewer.lastName}` : '—',
      locationOrLink: i.locationOrLink,
    })),
    offers: candidate.offerLetters,
    joining: candidate.joining,
  });
}

// POST /api/portal?t=<token> — candidate sends message to HR
export async function POST(request: NextRequest) {
  const verify = await verifyToken(request);
  if (!verify.ok) return verify.response;
  const candidateId = verify.candidateId;

  const body = await request.json();
  const parsed = portalMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { firstName: true, lastName: true } });
  const fromName = parsed.data.fromName ?? `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim();

  const message = await prisma.candidatePortalMessage.create({
    data: {
      candidateId,
      fromRole: 'candidate',
      fromName,
      message: parsed.data.message,
    },
  });

  return NextResponse.json(message, { status: 201 });
}
