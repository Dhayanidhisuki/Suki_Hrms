/**
 * GET   /api/training-schedules/[id]/checklist — §44 checklist for a schedule.
 *         Items from the attached TrainingChecklist template. Items whose
 *         label matches a known keyword are auto-evaluated from live schedule
 *         state (e.g. "Venue confirmed" → venueId != null); the rest are
 *         manual and persisted in schedule.checklistJson.
 * PATCH /api/training-schedules/[id]/checklist { itemId, done }
 *         toggles a manual item. Auto items are computed and cannot be set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

type ChecklistState = Record<string, { done: boolean; checkedAt?: string }>;

function parseState(json: string | null): ChecklistState {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as ChecklistState) : {};
  } catch {
    return {};
  }
}

/** Keyword → does this label describe a condition the system can verify? */
function autoKey(label: string): string | null {
  const l = label.toLowerCase();
  if (/trainer|facilitator|instructor/.test(l)) return 'trainer';
  if (/venue|room|hall|location/.test(l)) return 'venue';
  if (/participant|nominee|attendee|nominat/.test(l)) return 'participants';
  if (/meeting|link|teams|zoom|online/.test(l)) return 'meetingLink';
  if (/material|handout|slide|content/.test(l)) return 'materials';
  if (/co-?ordinator/.test(l)) return 'coordinator';
  if (/attendance/.test(l)) return 'attendance';
  if (/assessment|test|quiz|exam/.test(l)) return 'assessment';
  if (/feedback/.test(l)) return 'feedback';
  if (/certificat/.test(l)) return 'certificate';
  if (/effectiveness|evaluation|follow.?up/.test(l)) return 'effectiveness';
  if (/complet|conduct|deliver|session/.test(l)) return 'conducted';
  return null;
}

async function loadSchedule(companyId: number, scheduleId: number) {
  return prisma.trainingSchedule.findFirst({
    where: { id: scheduleId, companyId, deletedAt: null },
    select: {
      id: true, checklistId: true, checklistJson: true, status: true,
      trainerId: true, coTrainerId: true, venueId: true, meetingLink: true,
      materials: true, coordinator: true,
      assessmentRequired: true, feedbackRequired: true, certificationRequired: true,
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;
  const { id } = await params;
  const scheduleId = parseInt(id);

  const schedule = await loadSchedule(companyId, scheduleId);
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  if (!schedule.checklistId) {
    return NextResponse.json({ data: { scheduleId, checklistId: null, checklistName: null, items: [] } });
  }

  const checklist = await prisma.trainingChecklist.findFirst({
    where: { id: schedule.checklistId, companyId, deletedAt: null },
    include: {
      items: {
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, sortOrder: true, isMandatory: true },
      },
    },
  });
  if (!checklist) return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });

  // Live counts used by the auto rules.
  const [approvedNoms, attendanceCount, assessmentCount, feedbackCount, certificateCount, effectivenessCount] =
    await Promise.all([
      prisma.trainingNomination.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null, status: { in: ['APPROVED', 'NOMINATED'] } } }),
      prisma.trainingAttendance.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null } }),
      prisma.assessment.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null } }),
      prisma.trainingFeedback.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null } }),
      prisma.trainingCertificate.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null } }),
      prisma.trainingEffectiveness.count({ where: { companyId, trainingScheduleId: scheduleId, deletedAt: null } }),
    ]);

  const auto: Record<string, boolean> = {
    trainer: schedule.trainerId != null || schedule.coTrainerId != null,
    venue: schedule.venueId != null,
    participants: approvedNoms > 0,
    meetingLink: schedule.meetingLink != null && schedule.meetingLink.length > 0,
    materials: schedule.materials != null && schedule.materials.length > 0,
    coordinator: schedule.coordinator != null && schedule.coordinator.length > 0,
    attendance: attendanceCount > 0,
    assessment: assessmentCount > 0 || !schedule.assessmentRequired,
    feedback: feedbackCount > 0 || !schedule.feedbackRequired,
    certificate: certificateCount > 0 || !schedule.certificationRequired,
    effectiveness: effectivenessCount > 0,
    conducted: ['IN_PROGRESS', 'COMPLETED'].includes(schedule.status),
  };

  const manual = parseState(schedule.checklistJson);
  const items = checklist.items.map((it) => {
    const key = autoKey(it.label);
    if (key) {
      return { itemId: it.id, label: it.label, sortOrder: it.sortOrder, isMandatory: it.isMandatory, auto: true, done: auto[key] };
    }
    const m = manual[String(it.id)];
    return { itemId: it.id, label: it.label, sortOrder: it.sortOrder, isMandatory: it.isMandatory, auto: false, done: m?.done ?? false, checkedAt: m?.checkedAt ?? null };
  });

  return NextResponse.json({
    data: {
      scheduleId,
      checklistId: checklist.id,
      checklistName: checklist.name,
      items,
      completedCount: items.filter((i) => i.done).length,
      mandatoryPending: items.filter((i) => i.isMandatory && !i.done).length,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;
  const { id } = await params;
  const scheduleId = parseInt(id);

  const body = await request.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const done = Boolean(body?.done);
  if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

  const schedule = await loadSchedule(companyId, scheduleId);
  if (!schedule?.checklistId) return NextResponse.json({ error: 'No checklist attached to this schedule' }, { status: 404 });

  const item = await prisma.trainingChecklistItem.findFirst({
    where: { id: itemId, checklistId: schedule.checklistId, isActive: true, deletedAt: null },
    select: { id: true, label: true },
  });
  if (!item) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
  if (autoKey(item.label)) {
    return NextResponse.json({ error: 'This item is auto-verified and cannot be changed manually' }, { status: 409 });
  }

  const state = parseState(schedule.checklistJson);
  state[String(itemId)] = { done, checkedAt: done ? new Date().toISOString() : undefined };
  await prisma.trainingSchedule.update({
    where: { id: scheduleId },
    data: { checklistJson: JSON.stringify(state) },
  });

  await auditLearning(companyId, actor, 'TrainingSchedule', scheduleId, 'CHECKLIST_UPDATE', null,
    { itemId, label: item.label, done }, `Checklist item "${item.label}" → ${done ? 'done' : 'pending'}`);

  return NextResponse.json({ data: { itemId, done } });
}
