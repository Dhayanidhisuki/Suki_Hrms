import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { LETTER_TYPES, issueHrLetter, type LetterType } from '@/lib/letters/generate-letter';
import { resolveActor } from '@/lib/platform/workflow/http';

const issueSchema = z.object({
  letterType: z.enum(LETTER_TYPES),
  employeeId: z.coerce.number().int().positive().optional(),
  applicantId: z.coerce.number().int().positive().optional(),
  purpose: z.string().trim().max(200).optional(),
  ctcText: z.string().trim().max(120).optional(),
  misconduct: z.string().trim().max(500).optional(),
  absencePeriod: z.string().trim().max(200).optional(),
  joinDate: z.coerce.date().optional(),
  effectiveDate: z.coerce.date().optional(),
  lastWorkingDay: z.coerce.date().optional(),
  explanationDeadline: z.coerce.date().optional(),
});

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const letterType = request.nextUrl.searchParams.get('letterType');
  const data = await prisma.generatedHrLetter.findMany({
    where: {
      companyId: scope.companyId,
      ...(letterType ? { letterType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: scope.companyId }, select: { name: true } });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  let personName = '';
  let employeeCode: string | undefined;
  let designation: string | undefined;
  let department: string | undefined;
  let joinDate = parsed.data.joinDate;

  if (parsed.data.employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, companyId: scope.companyId, deletedAt: null },
      include: {
        jobInfos: {
          where: { effectiveTo: null },
          take: 1,
          include: { designation: true, department: true },
        },
      },
    });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    personName = `${emp.firstName} ${emp.lastName}`.trim();
    employeeCode = emp.employeeCode;
    designation = emp.jobInfos[0]?.designation?.name;
    department = emp.jobInfos[0]?.department?.name;
    joinDate = joinDate ?? emp.jobInfos[0]?.joinDate ?? undefined;
  } else if (parsed.data.applicantId) {
    const app = await prisma.recruitmentApplicant.findFirst({
      where: { id: parsed.data.applicantId, companyId: scope.companyId },
    });
    if (!app) return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
    personName = `${app.firstName} ${app.lastName}`.trim();
    joinDate = joinDate ?? app.joiningDate ?? app.availableJoinDate ?? undefined;
  } else {
    return NextResponse.json({ error: 'employeeId or applicantId is required' }, { status: 400 });
  }

  const actor = await resolveActor(request);
  try {
    const issued = await issueHrLetter({
      companyId: scope.companyId,
      letterType: parsed.data.letterType as LetterType,
      employeeId: parsed.data.employeeId ?? null,
      applicantId: parsed.data.applicantId ?? null,
      actor,
      purpose: parsed.data.purpose,
      fields: {
        companyName: company.name,
        personName,
        employeeCode,
        designation,
        department,
        joinDate,
        effectiveDate: parsed.data.effectiveDate,
        lastWorkingDay: parsed.data.lastWorkingDay,
        ctcText: parsed.data.ctcText,
        purpose: parsed.data.purpose,
        misconduct: parsed.data.misconduct,
        absencePeriod: parsed.data.absencePeriod,
        explanationDeadline: parsed.data.explanationDeadline,
      },
    });
    return NextResponse.json(
      { id: issued.id, referenceNo: issued.referenceNo, platformDocumentId: issued.platformDocumentId },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Issue failed' }, { status: 400 });
  }
}
