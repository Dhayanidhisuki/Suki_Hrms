/**
 * Statutory Forms API — unified GET/POST/PUT for all 6 joining forms (BRD §7.2-7.7).
 *
 * GET  /api/recruitment/statutory-forms?candidateId=&formType=
 * POST /api/recruitment/statutory-forms  — create or update (upsert by candidateId)
 *
 * formType: joining-form | joining-report | gratuity | pf | esi | insurance
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  joiningFormSchema,
  joiningReportSchema,
  gratuityNominationSchema,
  pfNominationSchema,
  esiApplicationSchema,
  insuranceFormSchema,
} from '@/lib/validations/recruitment';

type FormType = 'joining-form' | 'joining-report' | 'gratuity' | 'pf' | 'esi' | 'insurance';

const VALID_FORM_TYPES: FormType[] = ['joining-form', 'joining-report', 'gratuity', 'pf', 'esi', 'insurance'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get('candidateId');
  const formType = searchParams.get('formType') as FormType | null;

  if (!candidateId) return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
  const cid = parseInt(candidateId);

  if (formType) {
    if (!VALID_FORM_TYPES.includes(formType)) {
      return NextResponse.json({ error: 'Invalid formType' }, { status: 400 });
    }
    const record = await getForm(formType, cid);
    return NextResponse.json({ data: record });
  }

  // Return all forms for the candidate
  const results = await Promise.all(VALID_FORM_TYPES.map(async (ft) => ({ formType: ft, data: await getForm(ft, cid) })));
  return NextResponse.json({ data: results });
}

async function getForm(formType: FormType, candidateId: number) {
  switch (formType) {
    case 'joining-form':
      return await prisma.joiningForm.findUnique({ where: { candidateId } });
    case 'joining-report':
      return await prisma.joiningReport.findUnique({
        where: { candidateId },
        include: { location: { select: { id: true, name: true } }, designation: { select: { id: true, name: true } } },
      });
    case 'gratuity':
      return await prisma.gratuityNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
    case 'pf':
      return await prisma.pfNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
    case 'esi':
      return await prisma.esiApplication.findUnique({ where: { candidateId } });
    case 'insurance':
      return await prisma.insuranceForm.findUnique({ where: { candidateId } });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { formType } = body;
  if (!formType || !VALID_FORM_TYPES.includes(formType)) {
    return NextResponse.json({ error: 'Invalid or missing formType' }, { status: 400 });
  }

  switch (formType as FormType) {
    case 'joining-form':
      return await upsertJoiningForm(body);
    case 'joining-report':
      return await upsertJoiningReport(body);
    case 'gratuity':
      return await upsertGratuity(body);
    case 'pf':
      return await upsertPf(body);
    case 'esi':
      return await upsertEsi(body);
    case 'insurance':
      return await upsertInsurance(body);
  }
}

async function upsertJoiningForm(body: Record<string, unknown>) {
  const parsed = joiningFormSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const applicationNo = candidate.applicationNo;
  const record = await prisma.joiningForm.upsert({
    where: { candidateId },
    create: { candidateId, applicationNo, ...prismaData(cleanNulls(data)) },
    update: prismaData(cleanNulls(data)),
  });
  return NextResponse.json(record);
}

async function upsertJoiningReport(body: Record<string, unknown>) {
  const parsed = joiningReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.joiningReport.upsert({
    where: { candidateId },
    create: { candidateId, ...prismaData(cleanNulls(data)) },
    update: prismaData(cleanNulls(data)),
  });
  return NextResponse.json(record);
}

async function upsertGratuity(body: Record<string, unknown>) {
  const parsed = gratuityNominationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, nominees, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.gratuityNomination.findUnique({ where: { candidateId } });
    if (existing) {
      await tx.gratuityNominee.deleteMany({ where: { nominationId: existing.id } });
      await tx.gratuityNomination.update({ where: { candidateId }, data: prismaData(cleanNulls(data)) });
      if (nominees.length > 0) {
        await tx.gratuityNominee.createMany({ data: nominees.map((n) => ({ nominationId: existing.id, ...n })) });
      }
      return tx.gratuityNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
    }
    const created = await tx.gratuityNomination.create({ data: { candidateId, ...prismaData(cleanNulls(data)) } });
    if (nominees.length > 0) {
      await tx.gratuityNominee.createMany({ data: nominees.map((n) => ({ nominationId: created.id, ...n })) });
    }
    return tx.gratuityNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
  });
  return NextResponse.json(record);
}

async function upsertPf(body: Record<string, unknown>) {
  const parsed = pfNominationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, nominees, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.pfNomination.findUnique({ where: { candidateId } });
    if (existing) {
      await tx.pfNominee.deleteMany({ where: { nominationId: existing.id } });
      await tx.pfNomination.update({ where: { candidateId }, data: prismaData(cleanNulls(data)) });
      if (nominees.length > 0) {
        await tx.pfNominee.createMany({ data: nominees.map((n) => ({ nominationId: existing.id, ...n })) });
      }
      return tx.pfNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
    }
    const created = await tx.pfNomination.create({ data: { candidateId, ...prismaData(cleanNulls(data)) } });
    if (nominees.length > 0) {
      await tx.pfNominee.createMany({ data: nominees.map((n) => ({ nominationId: created.id, ...n })) });
    }
    return tx.pfNomination.findUnique({ where: { candidateId }, include: { nominees: true } });
  });
  return NextResponse.json(record);
}

async function upsertEsi(body: Record<string, unknown>) {
  const parsed = esiApplicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.esiApplication.upsert({
    where: { candidateId },
    create: { candidateId, ...prismaData(cleanNulls(data)) },
    update: prismaData(cleanNulls(data)),
  });
  return NextResponse.json(record);
}

async function upsertInsurance(body: Record<string, unknown>) {
  const parsed = insuranceFormSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const { candidateId, ...data } = parsed.data;
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, deletedAt: null } });
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

  const record = await prisma.insuranceForm.upsert({
    where: { candidateId },
    create: { candidateId, ...prismaData(cleanNulls(data)) },
    update: prismaData(cleanNulls(data)),
  });
  return NextResponse.json(record);
}

function cleanNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

// Cast helper for Prisma create/update inputs that expect specific types
/* eslint-disable @typescript-eslint/no-explicit-any */
function prismaData(data: Record<string, unknown>): any {
  return data as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
