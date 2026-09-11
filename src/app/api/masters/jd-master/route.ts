/**
 * GET  /api/jd-master — paginated list (search/filters + usageCount)
 * POST /api/jd-master — create (auto jdCode). Duplicate Active JD for the
 * same department + designation returns a warning unless acknowledgeDuplicate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { saveUploadedFile } from '@/lib/file-storage';
import { jobDescriptionCreateSchema } from '@/lib/validations/jd-master';
import {
  allocateJdCode,
  buildListWhere,
  findActiveDuplicate,
  jdInclude,
  normalizeTags,
  parseTagFilters,
  replaceTags,
  serializeJd,
  usageCountMap,
} from '@/lib/jd-master';

const JD_FILE_EXTS = new Set(['.pdf', '.doc', '.docx']);
const MAX_BYTES = 10 * 1024 * 1024;

async function parseCreateBody(request: NextRequest): Promise<{
  body: Record<string, unknown>;
  file: File | null;
}> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const fileRaw = form.get('file');
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key === 'file') continue;
      body[key] = typeof value === 'string' ? value : String(value);
    }
    return { body, file };
  }
  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  return { body: json ?? {}, file: null };
}

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const search = searchParams.get('search')?.trim() || undefined;
    const departmentId = searchParams.get('departmentId') ? Number(searchParams.get('departmentId')) : undefined;
    const designationId = searchParams.get('designationId') ? Number(searchParams.get('designationId')) : undefined;
    const status = searchParams.get('status')?.trim() || undefined;
    const tags = parseTagFilters(searchParams);

    const where = buildListWhere({
      search,
      departmentId: departmentId && !Number.isNaN(departmentId) ? departmentId : undefined,
      designationId: designationId && !Number.isNaN(designationId) ? designationId : undefined,
      status,
      tags,
    });

    const [rows, total] = await Promise.all([
      prisma.jobDescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { jdCode: 'asc' },
        include: jdInclude,
      }),
      prisma.jobDescription.count({ where }),
    ]);

    const usage = await usageCountMap(rows.map((r) => r.id));

    return NextResponse.json({
      data: rows.map((r) => serializeJd(r, usage.get(r.id) ?? 0)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[jd-master GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load JD list' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const createdByUserId = Number(request.headers.get('x-user-id')) || null;
  const { body, file } = await parseCreateBody(request);
  const parsed = jobDescriptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { departmentId, designationId, title, description, acknowledgeDuplicate } = parsed.data;
  const tags = normalizeTags(parsed.data.tags);
  const minExperienceYears = parsed.data.minExperienceYears ?? null;
  const maxExperienceYears = parsed.data.maxExperienceYears ?? null;
  const salaryPackage = parsed.data.salaryPackage ?? null;

  const [department, designation] = await Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, deletedAt: null }, select: { id: true } }),
    prisma.designation.findFirst({ where: { id: designationId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 400 });
  if (!designation) return NextResponse.json({ error: 'Designation not found' }, { status: 400 });

  const duplicate = await findActiveDuplicate(departmentId, designationId);
  if (duplicate && !acknowledgeDuplicate) {
    return NextResponse.json(
      {
        duplicateWarning: true,
        message: `A JD already exists for this Department + Designation (${duplicate.jdCode}) — continue anyway?`,
        existing: duplicate,
      },
      { status: 409 }
    );
  }

  if (file) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large — maximum 10 MB' }, { status: 400 });
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!JD_FILE_EXTS.has(ext)) {
      return NextResponse.json({ error: 'Only PDF or DOC/DOCX files are allowed' }, { status: 400 });
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const jdCode = await allocateJdCode(tx);
      const record = await tx.jobDescription.create({
        data: {
          jdCode,
          departmentId,
          designationId,
          title,
          description,
          minExperienceYears,
          maxExperienceYears,
          salaryPackage,
          status: 'Active',
          createdByUserId,
        },
      });
      await replaceTags(tx, record.id, tags);
      return record;
    });

    let jdFileUrl: string | null = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      jdFileUrl = await saveUploadedFile(buffer, `jd-master/${created.id}`, file.name);
      await prisma.jobDescription.update({ where: { id: created.id }, data: { jdFileUrl } });
    }

    const full = await prisma.jobDescription.findFirstOrThrow({
      where: { id: created.id },
      include: jdInclude,
    });

    return NextResponse.json(
      { ...serializeJd(full, 0), duplicateWarning: Boolean(duplicate) },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 400 }
    );
  }
}
