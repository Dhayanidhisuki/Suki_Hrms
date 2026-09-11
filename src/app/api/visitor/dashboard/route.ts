import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkVisitorPermission } from '@/lib/rbac-visitor';

export async function GET(request: NextRequest) {
  const permErr = await checkVisitorPermission(request, 'view');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;
  const { companyId } = scope;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    expectedVisitors,
    visitorsInside,
    pendingApprovals,
    overdueVisitors,
    todaysCheckins,
    todaysCheckouts,
    visitorStatusCounts,
    gnrStatusCounts,
    todaysGnr,
  ] = await Promise.all([
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'APPROVED', visitDate: { gte: today, lt: tomorrow } },
    }),
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'CHECKED_IN' },
    }),
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'PENDING_APPROVAL' },
    }),
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'APPROVED', validTo: { lt: new Date() } },
    }),
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'CHECKED_IN', checkInTime: { gte: today, lt: tomorrow } },
    }),
    prisma.visitorGatePass.count({
      where: { companyId, deletedAt: null, status: 'CHECKED_OUT', checkOutTime: { gte: today, lt: tomorrow } },
    }),
    prisma.visitorGatePass.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { status: true },
    }),
    prisma.gateNumberRegister.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { status: true },
    }),
    prisma.gateNumberRegister.count({
      where: { companyId, deletedAt: null, createdAt: { gte: today, lt: tomorrow } },
    }),
  ]);

  return NextResponse.json({
    visitor: {
      expectedToday: expectedVisitors,
      inside: visitorsInside,
      pendingApprovals,
      overdue: overdueVisitors,
      todaysCheckins,
      todaysCheckouts,
      statusBreakdown: visitorStatusCounts.reduce((acc, cur) => {
        acc[cur.status] = cur._count.status;
        return acc;
      }, {} as Record<string, number>),
    },
    material: {
      todaysGnr,
      statusBreakdown: gnrStatusCounts.reduce((acc, cur) => {
        acc[cur.status] = cur._count.status;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}
