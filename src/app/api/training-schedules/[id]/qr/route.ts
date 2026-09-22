/**
 * GET /api/training-schedules/[id]/qr
 *   — returns the check-in URL for a schedule (BRD §22 QR attendance).
 *   Admins encode this URL into a QR code (any QR tool / the venue poster).
 *   Scanning it lands the employee on ESS My Trainings, which performs the
 *   self check-in via /api/training-schedules/[id]/check-in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;
  const scheduleId = parseInt(id);

  const schedule = await prisma.trainingSchedule.findFirst({
    where: { id: scheduleId, companyId, deletedAt: null },
    select: { id: true, title: true, scheduledDate: true, startTime: true, status: true },
  });
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  return NextResponse.json({
    scheduleId,
    title: schedule.title,
    scheduledDate: schedule.scheduledDate,
    checkInUrl: `${origin}/ess/my-trainings?checkin=${scheduleId}`,
  });
}
