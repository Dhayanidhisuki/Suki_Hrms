import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { externalTrainingSchema } from '@/lib/validations/learning';
import { learningAuth, auditLearning, notifyLearning, resolveBudget, budgetExceeded, isLearningAdmin } from '@/lib/learning/shared';

// GET /api/external-trainings — external training with PO/invoice/payment (§35).
export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const provider = searchParams.get('provider');
  const providerId = searchParams.get('providerId');
  const search = searchParams.get('search') ?? '';
  const employeeId = searchParams.get('employeeId') ?? ''; // participant
  const from = searchParams.get('from') ?? ''; // startDate >=
  const to = searchParams.get('to') ?? '';     // startDate <=

  const data = await prisma.externalTraining.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(provider ? { providerName: { contains: provider } } : {}),
      ...(providerId ? { providerId: parseInt(providerId) } : {}),
      ...(search ? { title: { contains: search } } : {}),
      ...(from || to ? { startDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  // §35: attach real participant records (additive — employeeIds CSV kept as-is).
  const ids = data.map((r) => r.id);
  const participants = ids.length
    ? await prisma.externalTrainingParticipant.findMany({
        where: { companyId, externalTrainingId: { in: ids }, deletedAt: null },
      })
    : [];
  const byTraining = new Map<number, typeof participants>();
  for (const p of participants) {
    const arr = byTraining.get(p.externalTrainingId) ?? [];
    arr.push(p);
    byTraining.set(p.externalTrainingId, arr);
  }
  // §46: employeeId filter — trainings where the employee is a participant.
  const empIdNum = employeeId ? parseInt(employeeId) : null;
  const enriched = data
    .map((r) => ({ ...r, participants: byTraining.get(r.id) ?? [] }))
    .filter((r) => empIdNum == null || r.participants.some((p) => p.employeeId === empIdNum));

  return NextResponse.json({ data: enriched });
}

export async function POST(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId, actor } = auth;

  const body = await request.json();
  const parsed = externalTrainingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // §35: resolve providerName from the TrainingProvider master when linked.
  if (parsed.data.providerId && !parsed.data.providerName) {
    const provider = await prisma.trainingProvider.findFirst({
      where: { id: parsed.data.providerId, companyId, deletedAt: null },
      select: { name: true, contactName: true, email: true, phone: true },
    });
    if (!provider) {
      return NextResponse.json({ error: 'Training provider not found' }, { status: 400 });
    }
    parsed.data.providerName = provider.name;
    if (!parsed.data.providerContact) {
      parsed.data.providerContact = provider.contactName ?? provider.email ?? provider.phone ?? null;
    }
  }
  const providerName = parsed.data.providerName;
  if (!providerName) {
    return NextResponse.json({ error: 'providerName or providerId is required' }, { status: 400 });
  }

  // §51: external training spend is validated against the approved budget
  // (company-wide budget for the start year). Admin may pass ?override=1.
  const poAmount = Number(parsed.data.poAmount ?? 0);
  if (poAmount > 0) {
    const year = String(parsed.data.startDate?.getFullYear() ?? new Date().getFullYear());
    const budget = await resolveBudget(companyId, year, null);
    const msg = budgetExceeded(budget, poAmount);
    if (msg && !(request.nextUrl.searchParams.get('override') === '1' && (await isLearningAdmin(request)))) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }

  // §51 policy gate: externalBudgetCap — PO amounts above the policy cap
  // require escalation. Admin may pass ?override=1.
  if (poAmount > 0) {
    const policy = await prisma.trainingPolicy.findFirst({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { id: 'desc' },
      select: { externalBudgetCap: true },
    });
    const cap = policy?.externalBudgetCap != null ? Number(policy.externalBudgetCap) : null;
    if (cap != null && poAmount > cap && !(request.nextUrl.searchParams.get('override') === '1' && (await isLearningAdmin(request)))) {
      return NextResponse.json(
        { error: `PO amount ${poAmount} exceeds the policy external-training cap of ${cap} — escalation required` },
        { status: 409 }
      );
    }
  }

  const record = await prisma.externalTraining.create({ data: { ...parsed.data, providerName, companyId } });
  await auditLearning(companyId, actor, 'ExternalTraining', record.id, 'CREATE', null, record);
  notifyLearning(companyId, 'TNA_SUBMITTED', {
    moduleCode: 'TRDV',
    sourceEntityType: 'ExternalTraining',
    sourceEntityId: record.id,
    linkPath: '/learning/operations',
    data: { Request: { Source: 'EXTERNAL', Priority: 'NORMAL' } },
  });
  return NextResponse.json(record, { status: 201 });
}
