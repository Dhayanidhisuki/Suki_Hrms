import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';

const STATUSES = [
  'REGISTERED',
  'SCREENING',
  'INTERVIEW',
  'DOC_VERIFICATION',
  'SELECTED',
  'OFFERED',
  'JOINED',
  'REJECTED',
] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  expectedSalary: z.coerce.number().optional().nullable(),
  noticePeriod: z.string().trim().max(50).optional().nullable(),
  availableJoinDate: z.coerce.date().optional().nullable(),
  proposedSalary: z.coerce.number().optional().nullable(),
  joiningDate: z.coerce.date().optional().nullable(),
  offerNo: z.string().trim().max(50).optional().nullable(),
  recruiterRemarks: z.string().trim().max(1000).optional().nullable(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  designationId: z.coerce.number().int().positive().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = Number((await params).id);
  const row = await prisma.recruitmentApplicant.findFirst({ where: { id, companyId: scope.companyId } });
  if (!row) return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const id = Number((await params).id);
  const existing = await prisma.recruitmentApplicant.findFirst({ where: { id, companyId: scope.companyId } });
  if (!existing) return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  const row = await prisma.recruitmentApplicant.update({ where: { id }, data: parsed.data });
  return NextResponse.json(row);
}
