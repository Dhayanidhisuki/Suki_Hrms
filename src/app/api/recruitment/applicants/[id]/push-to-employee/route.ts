/**
 * POST /api/recruitment/applicants/[id]/push-to-employee
 * Calls the employee-master from-candidate contract, then moves candidate
 * PlatformDocuments onto the new employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { fromCandidateSchema } from '@/lib/validations/employee-master';
import { transferCandidateDocumentsToEmployee } from '@/lib/platform/document/index-document';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const applicantId = Number((await params).id);
  const applicant = await prisma.recruitmentApplicant.findFirst({
    where: { id: applicantId, companyId: scope.companyId },
  });
  if (!applicant) return NextResponse.json({ error: 'Applicant not found' }, { status: 404 });
  if (applicant.employeeId) {
    return NextResponse.json({ error: 'Already converted', employeeId: applicant.employeeId }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = fromCandidateSchema.safeParse({
    sourceApplicationNo: applicant.applicationNo,
    offerNo: applicant.offerNo ?? body.offerNo,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    dateOfBirth: applicant.dateOfBirth ?? body.dateOfBirth,
    gender: body.gender,
    mobile: applicant.mobile,
    personalEmail: applicant.email,
    ...body,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const cookie = request.headers.get('cookie') ?? '';
  const res = await fetch(`${origin}/api/employees/from-candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
      'x-user-id': request.headers.get('x-user-id') ?? '',
      'x-company-id': request.headers.get('x-company-id') ?? '',
      'x-role-id': request.headers.get('x-role-id') ?? '',
    },
    body: JSON.stringify(parsed.data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(json, { status: res.status });

  const employee =
    json.employee ??
    (json.employeeCode
      ? await prisma.employee.findFirst({
          where: { companyId: scope.companyId, employeeCode: json.employeeCode, deletedAt: null },
        })
      : null);
  const employeeId = employee?.id ?? json.employeeId ?? json.id;
  if (typeof employeeId === 'number') {
    const moved = await transferCandidateDocumentsToEmployee(scope.companyId, applicantId, employeeId);
    await prisma.recruitmentApplicant.update({
      where: { id: applicantId },
      data: { employeeId, status: 'JOINED' },
    });
    return NextResponse.json({ ...json, employeeId, documentsTransferred: moved });
  }
  return NextResponse.json({ ...json, warning: 'Employee created but id not returned; documents not transferred' });
}
