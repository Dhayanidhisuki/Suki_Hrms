/**
 * Recruitment Dashboard Stats — pipeline counts + velocity metrics (BRD §5.1, §10.5).
 * GET /api/recruitment/dashboard-stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // Pipeline counts by status category
  const statuses = await prisma.recruitmentStatus.findMany({ where: { isActive: true }, orderBy: { sequence: 'asc' } });
  const statusCounts = await Promise.all(
    statuses.map(async (s) => ({
      statusCode: s.statusCode,
      statusName: s.statusName,
      stageCategory: s.stageCategory,
      color: s.color,
      count: await prisma.candidate.count({ where: { currentStatusId: s.id, deletedAt: null } }),
    }))
  );

  // Summary pipeline cards (BRD §5.1)
  const totalApplicants = await prisma.candidate.count({ where: { deletedAt: null } });
  const newApplicants = statusCounts.find((s) => s.statusCode === 'NEW')?.count ?? 0;
  const callPending = statusCounts.find((s) => s.statusCode === 'CALL_INTERVIEW')?.count ?? 0;
  const interviewScheduled = statusCounts.filter((s) => s.stageCategory === 'Interview').reduce((sum, s) => sum + s.count, 0);
  const evaluationPending = await prisma.interviewSchedule.count({
    where: { status: 'Completed', evaluationSummary: null },
  });
  const docVerification = statusCounts.find((s) => s.statusCode === 'DOCUMENT_VERIFICATION')?.count ?? 0;
  const selected = statusCounts.find((s) => s.statusCode === 'FINAL_APPROVAL')?.count ?? 0;
  const offerReleased = statusCounts.filter((s) => s.stageCategory === 'Offer').reduce((sum, s) => sum + s.count, 0);
  const joined = statusCounts.find((s) => s.statusCode === 'JOINED')?.count ?? 0;
  const rejected = statusCounts.find((s) => s.statusCode === 'REJECTED')?.count ?? 0;

  // Open job postings
  const openPostings = await prisma.jobPosting.count({ where: { status: 'Open', deletedAt: null } });

  // Velocity metrics (BRD §10.5) — simplified for now
  // Time-to-hire: average days from applicantDate to joiningDate
  const joinedCandidates = await prisma.candidateJoining.findMany({
    where: { actualJoiningDate: { not: null } },
    include: { candidate: { select: { applicantDate: true } } },
  });
  const timeToHireDays =
    joinedCandidates.length > 0
      ? Math.round(
          joinedCandidates.reduce((sum, j) => {
            if (j.actualJoiningDate && j.candidate?.applicantDate) {
              return sum + (j.actualJoiningDate.getTime() - j.candidate.applicantDate.getTime()) / (1000 * 60 * 60 * 24);
            }
            return sum;
          }, 0) / joinedCandidates.length
        )
      : 0;

  // Offer acceptance rate
  const offersSent = await prisma.offerLetter.count({ where: { status: { in: ['Sent', 'Accepted', 'Rejected', 'Expired'] } } });
  const offersAccepted = await prisma.offerLetter.count({ where: { status: 'Accepted' } });
  const offerAcceptanceRate = offersSent > 0 ? Math.round((offersAccepted / offersSent) * 100) : 0;

  // SLA metrics (BRD §10.5) — compute Stage Aging + SLA Breach from SLA Config
  const slaConfigs = await prisma.slaConfig.findMany({ where: { isActive: true } });
  const slaMap = new Map(slaConfigs.map((s) => [s.stageCode, s.slaDays]));

  // Pipeline Aging: avg days candidates have been in their current stage
  const candidatesWithStatus = await prisma.candidate.findMany({
    where: { deletedAt: null, currentStatusId: { not: null } },
    include: { currentStatus: { select: { statusCode: true } }, activityLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
  });
  const now = new Date();
  let totalAgingDays = 0;
  let agingCount = 0;
  let slaBreachCount = 0;
  for (const c of candidatesWithStatus) {
    // Use the latest activity log entry as the stage entry time
    const stageEntry = c.activityLogs[0]?.createdAt ?? c.createdAt;
    const daysInStage = Math.floor((now.getTime() - stageEntry.getTime()) / (1000 * 60 * 60 * 24));
    totalAgingDays += daysInStage;
    agingCount += 1;
    const slaDays = slaMap.get(c.currentStatus?.statusCode ?? '');
    if (slaDays !== undefined && daysInStage > slaDays) {
      slaBreachCount += 1;
    }
  }
  const pipelineAging = agingCount > 0 ? Math.round(totalAgingDays / agingCount) : 0;

  return NextResponse.json({
    pipeline: {
      totalApplicants,
      newApplicants,
      callPending,
      interviewScheduled,
      evaluationPending,
      docVerification,
      selected,
      offerReleased,
      joined,
      rejected,
      openPostings,
    },
    byStatus: statusCounts,
    velocity: {
      timeToHireDays,
      offerAcceptanceRate,
      pipelineAging,
      slaBreachCount,
    },
  });
}
