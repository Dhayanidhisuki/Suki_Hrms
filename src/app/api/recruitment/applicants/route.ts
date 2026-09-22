import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';

const createSchema = z.object({
  title: z.string().trim().max(10).optional().nullable(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  mobile: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(100),
  dateOfBirth: z.coerce.date().optional().nullable(),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/).optional().nullable(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  designationId: z.coerce.number().int().positive().optional().nullable(),
  jobPostingId: z.coerce.number().int().positive().optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  referenceComments: z.string().trim().max(500).optional().nullable(),
});

async function nextApplicationNo(companyId: number): Promise<string> {
  const year = new Date().getUTCFullYear();
  const seq = await prisma.recruitmentApplicationSequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: { companyId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `APP/${year}/${String(seq.lastNumber).padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
  const status = request.nextUrl.searchParams.get('status');
  const search = request.nextUrl.searchParams.get('search')?.trim();
  const data = await prisma.recruitmentApplicant.findMany({
    where: {
      companyId: scope.companyId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { applicationNo: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { mobile: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ data });
  } catch (err) {
    console.error('[applicants] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load applicants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const dup = await prisma.recruitmentApplicant.findFirst({
    where: {
      companyId: scope.companyId,
      status: { not: 'REJECTED' },
      OR: [{ mobile: parsed.data.mobile }, { email: parsed.data.email }],
    },
  });
  if (dup) {
    return NextResponse.json(
      { error: `Duplicate mobile/email — existing ${dup.applicationNo}`, applicantId: dup.id },
      { status: 409 },
    );
  }

  const applicationNo = await nextApplicationNo(scope.companyId);
  const row = await prisma.recruitmentApplicant.create({
    data: {
      companyId: scope.companyId,
      applicationNo,
      ...parsed.data,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
