/**
 * Recruitment Reports API (BRD §18).
 * GET /api/recruitment/reports?type=
 *
 * Supported report types:
 *  1. pipeline          — Stage-wise candidate list
 *  2. time-to-hire      — Avg days by dept/designation
 *  3. sla-breach        — Candidates past SLA deadline
 *  4. source-wise       — Applications + conversion by source
 *  5. offer-acceptance  — Accepted/rejected/expired offers
 *  6. rejection         — Rejections by stage/reason
 *  7. interviewer-perf  — Interviews conducted + scores
 *  8. joining           — Joined candidates per period
 *  9. bgv               — BGV status across candidates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'pipeline';

  switch (type) {
    case 'pipeline':
      return await pipelineReport();
    case 'time-to-hire':
      return await timeToHireReport();
    case 'sla-breach':
      return await slaBreachReport();
    case 'source-wise':
      return await sourceWiseReport();
    case 'offer-acceptance':
      return await offerAcceptanceReport();
    case 'rejection':
      return await rejectionReport();
    case 'interviewer-perf':
      return await interviewerPerformanceReport();
    case 'joining':
      return await joiningReport();
    case 'bgv':
      return await bgvReport();
    default:
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  }
}

async function pipelineReport() {
  const candidates = await prisma.candidate.findMany({
    where: { deletedAt: null },
    include: {
      currentStatus: { select: { statusCode: true, statusName: true, stageCategory: true } },
      department: { select: { name: true } },
      designation: { select: { name: true } },
      sourceChannel: { select: { channelName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: candidates });
}

async function timeToHireReport() {
  const joinings = await prisma.candidateJoining.findMany({
    where: { actualJoiningDate: { not: null } },
    include: {
      candidate: {
        include: { department: { select: { name: true } }, designation: { select: { name: true } } },
      },
    },
  });
  const data = joinings.map((j) => {
    const days = j.actualJoiningDate && j.candidate.applicantDate
      ? Math.round((j.actualJoiningDate.getTime() - j.candidate.applicantDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      candidate: `${j.candidate.firstName} ${j.candidate.lastName}`,
      department: j.candidate.department?.name ?? '—',
      designation: j.candidate.designation?.name ?? '—',
      joinedAt: j.actualJoiningDate,
      daysToHire: days,
    };
  });
  return NextResponse.json({ data });
}

async function slaBreachReport() {
  const slaConfigs = await prisma.slaConfig.findMany({ where: { isActive: true } });
  const slaMap = new Map(slaConfigs.map((s) => [s.stageCode, s.slaDays]));
  const candidates = await prisma.candidate.findMany({
    where: { deletedAt: null, currentStatusId: { not: null } },
    include: {
      currentStatus: { select: { statusCode: true, statusName: true } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });
  const now = new Date();
  const breached = candidates
    .map((c) => {
      const stageEntry = c.activityLogs[0]?.createdAt ?? c.createdAt;
      const daysInStage = Math.floor((now.getTime() - stageEntry.getTime()) / (1000 * 60 * 60 * 24));
      const slaDays = slaMap.get(c.currentStatus?.statusCode ?? '');
      return {
        candidate: `${c.firstName} ${c.lastName}`,
        applicationNo: c.applicationNo,
        stage: c.currentStatus?.statusName ?? '—',
        daysInStage,
        slaDays: slaDays ?? null,
        breached: slaDays !== undefined && daysInStage > slaDays,
      };
    })
    .filter((r) => r.breached);
  return NextResponse.json({ data: breached });
}

async function sourceWiseReport() {
  const sources = await prisma.sourcingChannel.findMany({ where: { isActive: true } });
  const data = await Promise.all(
    sources.map(async (s) => {
      const total = await prisma.candidate.count({ where: { sourceChannelId: s.id, deletedAt: null } });
      const joined = await prisma.candidate.count({
        where: {
          sourceChannelId: s.id,
          deletedAt: null,
          currentStatus: { statusCode: 'JOINED' },
        },
      });
      return {
        channel: s.channelName,
        channelCode: s.channelCode,
        total,
        joined,
        conversionRate: total > 0 ? Math.round((joined / total) * 100) : 0,
      };
    })
  );
  return NextResponse.json({ data });
}

async function offerAcceptanceReport() {
  const offers = await prisma.offerLetter.findMany({
    include: { candidate: { select: { firstName: true, lastName: true, applicationNo: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: offers });
}

async function rejectionReport() {
  const rejected = await prisma.candidate.findMany({
    where: { deletedAt: null, currentStatus: { statusCode: 'REJECTED' } },
    include: {
      department: { select: { name: true } },
      designation: { select: { name: true } },
      activityLogs: { where: { toStatus: 'REJECTED' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  const data = rejected.map((c) => ({
    candidate: `${c.firstName} ${c.lastName}`,
    applicationNo: c.applicationNo,
    department: c.department?.name ?? '—',
    designation: c.designation?.name ?? '—',
    rejectedAt: c.activityLogs[0]?.createdAt ?? null,
    reason: c.activityLogs[0]?.remarks ?? '—',
  }));
  return NextResponse.json({ data });
}

async function interviewerPerformanceReport() {
  const evaluations = await prisma.interviewEvaluationSummary.findMany({
    include: {
      schedule: {
        include: {
          interviewer: { select: { firstName: true, lastName: true, employeeCode: true } },
          candidate: { select: { firstName: true, lastName: true, applicationNo: true } },
        },
      },
    },
    orderBy: { calculatedAt: 'desc' },
  });
  const data = evaluations.map((e) => ({
    interviewer: e.schedule.interviewer ? `${e.schedule.interviewer.firstName} ${e.schedule.interviewer.lastName}` : '—',
    candidate: e.schedule.candidate ? `${e.schedule.candidate.firstName} ${e.schedule.candidate.lastName}` : '—',
    totalScore: e.totalScore,
    weightedScore: e.weightedScore,
    result: e.result,
    recommendation: e.recommendation,
    calculatedAt: e.calculatedAt,
  }));
  return NextResponse.json({ data });
}

async function joiningReport() {
  const joinings = await prisma.candidateJoining.findMany({
    where: { joiningStatus: 'Joined' },
    include: {
      candidate: {
        include: { department: { select: { name: true } }, designation: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: joinings });
}

async function bgvReport() {
  const bgvRecords = await prisma.candidateBgv.findMany({
    include: {
      candidate: { select: { firstName: true, lastName: true, applicationNo: true } },
      bgvStep: { select: { stepName: true, stepCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: bgvRecords });
}
