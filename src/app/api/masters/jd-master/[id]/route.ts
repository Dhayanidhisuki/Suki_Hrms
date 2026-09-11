/**
 * GET    /api/jd-master/:id — detail + versions + linked job postings + usageCount
 * PATCH  /api/jd-master/:id — edit; snapshots current state into versions[] first
 * DELETE /api/jd-master/:id — blocked when usageCount > 0
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { saveUploadedFile } from '@/lib/file-storage';
import { jobDescriptionUpdateSchema } from '@/lib/validations/jd-master';
import {
  findActiveDuplicate,
  fileExtFromStored,
  fileUrlForJd,
  jdInclude,
  normalizeTags,
  replaceTags,
  serializeJd,
  usageCountFor,
  type JdWithRelations,
} from '@/lib/jd-master';

const JD_FILE_EXTS = new Set(['.pdf', '.doc', '.docx']);
const MAX_BYTES = 10 * 1024 * 1024;

async function parsePatchBody(request: NextRequest): Promise<{
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const record = await prisma.jobDescription.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...jdInclude,
      versions: {
        orderBy: { editedAt: 'desc' },
        include: { editedBy: { select: { id: true, email: true } } },
      },
      jobPostings: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const usageCount = await usageCountFor(id);
  const { versions, jobPostings, ...rest } = record;
  return NextResponse.json(
    serializeJd(rest as JdWithRelations, usageCount, {
      versions: versions.map((v) => ({
        ...v,
        jdFileExt: fileExtFromStored(v.jdFileUrl),
        jdFileUrl: fileUrlForJd(id, v.jdFileUrl),
      })),
      jobPostings,
    })
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const editedByUserId = Number(request.headers.get('x-user-id')) || null;

  const current = await prisma.jobDescription.findFirst({ where: { id, deletedAt: null } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { body, file } = await parsePatchBody(request);
  const parsed = jobDescriptionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const departmentId = parsed.data.departmentId ?? current.departmentId;
  const designationId = parsed.data.designationId ?? current.designationId;

  if (parsed.data.departmentId || parsed.data.designationId) {
    const [department, designation] = await Promise.all([
      prisma.department.findFirst({ where: { id: departmentId, deletedAt: null }, select: { id: true } }),
      prisma.designation.findFirst({ where: { id: designationId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 400 });
    if (!designation) return NextResponse.json({ error: 'Designation not found' }, { status: 400 });
  }

  const nextStatus = parsed.data.status ?? current.status;
  if (nextStatus === 'Active') {
    const duplicate = await findActiveDuplicate(departmentId, designationId, id);
    if (duplicate && !parsed.data.acknowledgeDuplicate) {
      return NextResponse.json(
        {
          duplicateWarning: true,
          message: `A JD already exists for this Department + Designation (${duplicate.jdCode}) — continue anyway?`,
          existing: duplicate,
        },
        { status: 409 }
      );
    }
  }

  let jdFileUrl = current.jdFileUrl;
  if (file) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large — maximum 10 MB' }, { status: 400 });
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!JD_FILE_EXTS.has(ext)) {
      return NextResponse.json({ error: 'Only PDF or DOC/DOCX files are allowed' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    jdFileUrl = await saveUploadedFile(buffer, `jd-master/${id}`, file.name);
  }

  const tags = parsed.data.tags !== undefined ? normalizeTags(parsed.data.tags) : null;

  await prisma.$transaction(async (tx) => {
    await tx.jobDescriptionVersion.create({
      data: {
        jobDescriptionId: id,
        title: current.title,
        description: current.description,
        jdFileUrl: current.jdFileUrl,
        minExperienceYears: current.minExperienceYears,
        maxExperienceYears: current.maxExperienceYears,
        salaryPackage: current.salaryPackage,
        editedByUserId,
      },
    });
    await tx.jobDescription.update({
      where: { id },
      data: {
        departmentId,
        designationId,
        title: parsed.data.title ?? current.title,
        description: parsed.data.description ?? current.description,
        minExperienceYears: parsed.data.minExperienceYears !== undefined ? parsed.data.minExperienceYears ?? null : current.minExperienceYears,
        maxExperienceYears: parsed.data.maxExperienceYears !== undefined ? parsed.data.maxExperienceYears ?? null : current.maxExperienceYears,
        salaryPackage: parsed.data.salaryPackage !== undefined ? parsed.data.salaryPackage : current.salaryPackage,
        status: nextStatus,
        jdFileUrl,
      },
    });
    if (tags) await replaceTags(tx, id, tags);
  });

  const full = await prisma.jobDescription.findFirstOrThrow({ where: { id }, include: jdInclude });
  const usageCount = await usageCountFor(id);
  return NextResponse.json(serializeJd(full, usageCount));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const current = await prisma.jobDescription.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const usageCount = await usageCountFor(id);
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error: `This JD is linked to ${usageCount} active postings/employees — cannot delete`,
        usageCount,
      },
      { status: 409 }
    );
  }

  await prisma.jobDescription.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'Archived' },
  });
  return NextResponse.json({ message: 'Deleted' });
}
