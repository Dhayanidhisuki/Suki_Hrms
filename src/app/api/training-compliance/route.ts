/**
 * GET /api/training-compliance — mandatory-training compliance status per
 * employee (BRD §39/§42). For every MANDATORY nomination, the employee is
 * COMPLIANT once they attended a completed schedule; OVERDUE when the
 * schedule date passed without attendance; PENDING while awaiting the
 * session; NOT_STARTED when the nomination is still awaiting approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningAuth } from '@/lib/learning/shared';

export async function GET(request: NextRequest) {
  const auth = learningAuth(request);
  if ('error' in auth) return auth.error;
  const { companyId } = auth;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') ?? '';
  const departmentId = searchParams.get('departmentId');

  const mandatory = await prisma.trainingNomination.findMany({
    where: { companyId, deletedAt: null, reason: 'MANDATORY' },
    include: {
      trainingSchedule: {
        select: {
          id: true, title: true, status: true, scheduledDate: true,
          trainingProgram: { select: { name: true } },
        },
      },
      attendance: { select: { status: true } },
    },
  });

  const employeeIds = Array.from(new Set(mandatory.map((n) => n.employeeId)));
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, companyId, deletedAt: null },
    include: {
      jobInfos: { where: { effectiveTo: null }, take: 1, include: { department: true, designation: true } },
    },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const today = new Date().toISOString().slice(0, 10);

  const rows = mandatory.map((n) => {
    const emp = empMap.get(n.employeeId);
    const job = emp?.jobInfos[0];
    const sched = n.trainingSchedule;
    let compliance: string;
    if (sched.status === 'COMPLETED') {
      compliance = n.attendance?.status === 'PRESENT' || n.attendance?.status === 'LATE' ? 'COMPLIANT' : 'NOT_COMPLETED';
    } else if (sched.scheduledDate && sched.scheduledDate.toISOString().slice(0, 10) < today) {
      compliance = 'OVERDUE';
    } else if (['PENDING', 'NOMINATED'].includes(n.status)) {
      compliance = 'NOT_STARTED';
    } else {
      compliance = 'PENDING';
    }
    if (['REJECTED', 'CANCELLED'].includes(n.status)) compliance = 'EXEMPTED';
    return {
      id: n.id,
      employeeId: n.employeeId,
      employeeCode: emp?.employeeCode ?? '—',
      employeeName: emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : `#${n.employeeId}`,
      departmentName: job?.department?.name ?? '—',
      designationName: job?.designation?.name ?? '—',
      departmentId: job?.departmentId ?? null,
      program: sched.trainingProgram?.name ?? sched.title ?? '—',
      scheduledDate: sched.scheduledDate?.toISOString().slice(0, 10) ?? '—',
      nominationStatus: n.status,
      compliance,
    };
  }).filter((r) =>
    (!statusFilter || r.compliance === statusFilter) &&
    (!departmentId || r.departmentId === parseInt(departmentId))
  );

  const kpis = {
    total: rows.length,
    compliant: rows.filter((r) => r.compliance === 'COMPLIANT').length,
    overdue: rows.filter((r) => r.compliance === 'OVERDUE').length,
    notStarted: rows.filter((r) => r.compliance === 'NOT_STARTED').length,
    pending: rows.filter((r) => r.compliance === 'PENDING').length,
  };

  return NextResponse.json({ data: rows, kpis });
}
