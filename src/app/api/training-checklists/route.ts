/**
 * Training checklists (BRD §44). Checklist + items are managed together:
 * POST creates the checklist with its items; PUT replaces the item list
 * (items are company-agnostic rows owned by the checklist).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trainingChecklistSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const data = await prisma.trainingChecklist.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { items: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = trainingChecklistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { items, ...checklistData } = parsed.data;

  const record = await prisma.trainingChecklist.create({
    data: {
      ...checklistData,
      companyId,
      items: { create: items },
    },
    include: { items: true },
  });

  await auditLearning(companyId, actor, 'TrainingChecklist', record.id, 'CREATE', null, record);
  return NextResponse.json(record, { status: 201 });
}
