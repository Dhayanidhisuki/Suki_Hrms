/**
 * GET  /api/masters/sites — list Sites (paginated, soft-delete filtered)
 * POST /api/masters/sites — create a Site
 *
 * Site is a physical-location master, company-scoped like Unit but
 * deliberately not FK'd to it — see the model comment in schema.prisma.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { siteSchema } from '@/lib/validations/master';
import { nextSequentialCode } from '@/lib/master-code';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';

  const where = {
    deletedAt: null,
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }, { city: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.site.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.site.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // Code is server-generated as SITE001, SITE002... — ignore whatever the client sent.
  const siblings = await prisma.site.findMany({ select: { code: true } });
  const code = nextSequentialCode(siblings.map((s) => s.code), 'SITE');

  const { code: _ignored, ...rest } = parsed.data;
  const record = await prisma.site.create({ data: { ...rest, code }, include: { company: { select: { id: true, name: true } } } });
  return NextResponse.json(record, { status: 201 });
}
