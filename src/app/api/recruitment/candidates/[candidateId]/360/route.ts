/**
 * Candidate 360° — full profile with all relations (BRD §5.18).
 * GET /api/recruitment/candidates/:id/360
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const fullInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  jobPosting: { select: { id: true, title: true } },
  sourceChannel: { select: { id: true, channelName: true } },
  currentStatus: { select: { id: true, statusCode: true, statusName: true, color: true, stageCategory: true } },
  createdBy: { select: { id: true, email: true } },
  detail: true,
  documents: {
    include: {
      documentType: { select: { id: true, documentName: true, category: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  activityLogs: {
    orderBy: { createdAt: 'desc' },
    include: { performedBy: { select: { id: true, email: true } } },
    take: 50,
  },
  callInterviews: {
    orderBy: { createdAt: 'desc' },
    include: { recruiter: { select: { id: true, firstName: true, lastName: true } } },
  },
  interviewSchedules: {
    orderBy: { scheduledDate: 'desc' },
    include: {
      interviewLevel: { select: { id: true, levelName: true } },
      interviewType: { select: { id: true, typeName: true } },
      interviewer: { select: { id: true, firstName: true, lastName: true } },
      evaluations: {
        include: {
          criteria: { select: { id: true, criteriaName: true } },
          submittedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      evaluationSummary: true,
    },
  },
  bgvRecords: {
    include: { bgvStep: { select: { id: true, stepName: true, sequence: true } } },
    orderBy: { createdAt: 'asc' },
  },
  checklistItems: {
    include: { checklistMaster: { select: { id: true, itemName: true, itemCode: true } } },
  },
  offerLetters: {
    orderBy: { createdAt: 'desc' },
    include: { offerTemplate: { select: { id: true, templateName: true } } },
  },
  appointmentOrders: { orderBy: { createdAt: 'desc' } },
  joining: true,
  internships: {
    include: {
      department: { select: { id: true, name: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
      policy: { select: { id: true, policyName: true } },
    },
  },
  communications: { orderBy: { sentAt: 'desc' }, take: 20 },
} as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const record = await prisma.candidate.findFirst({
    where: { id: parseInt(candidateId), deletedAt: null },
    include: fullInclude,
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...record, fullName: `${record.firstName} ${record.lastName}` });
}
