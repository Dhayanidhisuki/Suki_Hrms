import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { leaveMasterSchema } from '@/lib/validations/master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  // 'active' | 'inactive'; anything else (including absent) means no filter,
  // so an existing caller that never sends it keeps seeing every row.
  const status = searchParams.get('status');

  const where = {
    deletedAt: null,
    ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.leaveMaster.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.leaveMaster.count({ where }),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

const CODE_PREFIX = 'LT-';

/** Next LT-NNN code — scans existing LT- codes (including soft-deleted, so a
 *  deleted row's code is never reissued) and picks one past the highest. */
async function allocateLeaveMasterCode(): Promise<string> {
  const existing = await prisma.leaveMaster.findMany({
    where: { code: { startsWith: CODE_PREFIX } },
    select: { code: true },
  });
  const maxSeq = existing.reduce((max, e) => {
    const n = parseInt(e.code.slice(CODE_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${CODE_PREFIX}${String(maxSeq + 1).padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = leaveMasterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });

  // The Add form no longer collects a code — it's always auto-generated
  // (LT-001, LT-002, ...). A caller that still sends one (e.g. a script) is
  // honored as-is, matching the pre-existing manual codes (SL, CL, EL, ...).
  const code = parsed.data.code || (await allocateLeaveMasterCode());

  const existing = await prisma.leaveMaster.findUnique({ where: { code } });
  if (existing && existing.deletedAt === null) return NextResponse.json({ error: 'Code already exists' }, { status: 409 });

  const nameConflict = await prisma.leaveMaster.findFirst({ where: { name: parsed.data.name, deletedAt: null } });
  if (nameConflict) return NextResponse.json({ error: 'A leave type with this name already exists' }, { status: 409 });

  const record = await prisma.leaveMaster.create({ data: { ...parsed.data, code } });
  return NextResponse.json(record, { status: 201 });
}
