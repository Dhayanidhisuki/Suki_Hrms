import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId, findEmployeeInCompany } from '@/lib/companyScope';
import { FNF_CLEARANCE_CODES } from '@/lib/fnf/types';
import { ensureClearanceChecks } from '@/lib/fnf/eligibility';

const patchSchema = z.object({
  checkCode: z.enum(FNF_CLEARANCE_CODES),
  status: z.enum(['PENDING', 'CLEARED']),
  remark: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.separation.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const employee = await findEmployeeInCompany(parseInt((await params).id), scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const exit = await prisma.exitInterview.findUnique({ where: { employeeId: employee.id } });
  if (!exit) return NextResponse.json({ error: 'No separation recorded' }, { status: 404 });
  await ensureClearanceChecks(exit.id);
  const checks = await prisma.exitClearanceCheck.findMany({ where: { exitInterviewId: exit.id } });
  const allCleared = FNF_CLEARANCE_CODES.every((c) => checks.some((r) => r.checkCode === c && r.status === 'CLEARED'));
  if (allCleared && exit.clearanceStatus !== 'CLEARED') {
    await prisma.exitInterview.update({ where: { id: exit.id }, data: { clearanceStatus: 'CLEARED' } });
  }
  return NextResponse.json({ clearanceStatus: allCleared ? 'CLEARED' : 'PENDING', checks });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.separation.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const userId = Number(request.headers.get('x-user-id'));
  const employee = await findEmployeeInCompany(parseInt((await params).id), scope.companyId);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const exit = await prisma.exitInterview.findUnique({ where: { employeeId: employee.id } });
  if (!exit) return NextResponse.json({ error: 'No separation recorded' }, { status: 404 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'checkCode and status are required' }, { status: 400 });
  await ensureClearanceChecks(exit.id);
  const row = await prisma.exitClearanceCheck.update({
    where: { exitInterviewId_checkCode: { exitInterviewId: exit.id, checkCode: parsed.data.checkCode } },
    data: {
      status: parsed.data.status,
      remark: parsed.data.remark ?? null,
      clearedByUserId: parsed.data.status === 'CLEARED' && Number.isFinite(userId) ? userId : null,
      clearedAt: parsed.data.status === 'CLEARED' ? new Date() : null,
    },
  });
  const checks = await prisma.exitClearanceCheck.findMany({ where: { exitInterviewId: exit.id } });
  const allCleared = FNF_CLEARANCE_CODES.every((c) => checks.some((r) => r.checkCode === c && r.status === 'CLEARED'));
  await prisma.exitInterview.update({
    where: { id: exit.id },
    data: { clearanceStatus: allCleared ? 'CLEARED' : 'PENDING' },
  });
  return NextResponse.json({ check: row, clearanceStatus: allCleared ? 'CLEARED' : 'PENDING', checks });
}
