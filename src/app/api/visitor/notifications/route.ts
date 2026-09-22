import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { checkVisitorPermission } from '@/lib/rbac-visitor';

export async function GET(request: NextRequest) {
  const permErr = await checkVisitorPermission(request, 'view');
  if (permErr) return permErr;

  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const userId = request.headers.get('x-user-id');
  const user = userId ? await prisma.user.findUnique({ where: { id: Number(userId) }, select: { email: true } }) : null;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const status = searchParams.get('status') ?? '';

  const where: Prisma.VisitorNotificationLogWhereInput = { companyId: scope.companyId };
  if (status) where.status = status;
  if (user?.email) where.recipient = { contains: user.email };

  const [data, total] = await Promise.all([
    prisma.visitorNotificationLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.visitorNotificationLog.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function PUT(request: NextRequest) {
  const permErr = await checkVisitorPermission(request, 'view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const body = await request.json().catch(() => ({}));
  const ids = body.ids as number[] | undefined;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  }

  await prisma.visitorNotificationLog.updateMany({
    where: { id: { in: ids }, companyId: scope.companyId },
    data: { status: 'READ', readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
