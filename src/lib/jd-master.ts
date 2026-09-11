import type { Prisma } from '@prisma/client';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const JD_STATUSES = ['Draft', 'Active', 'Archived'] as const;
export type JdStatus = (typeof JD_STATUSES)[number];

export const jdInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, email: true } },
  tags: { select: { tag: true } },
} satisfies Prisma.JobDescriptionInclude;

export type JdWithRelations = Prisma.JobDescriptionGetPayload<{ include: typeof jdInclude }>;

export function normalizeTags(tags: unknown): string[] {
  if (tags == null) return [];
  const raw = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(/[,;]/)
      : [];
  const cleaned = raw
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0)
    .slice(0, 40);
  return [...new Set(cleaned)];
}

export function fileUrlForJd(id: number, jdFileUrl: string | null): string | null {
  if (!jdFileUrl) return null;
  if (jdFileUrl.startsWith('/api/') || jdFileUrl.startsWith('http')) return jdFileUrl;
  return `/api/masters/jd-master/${id}/file`;
}

export function fileExtFromStored(stored: string | null): string | null {
  if (!stored) return null;
  const ext = path.extname(stored.split('?')[0]).toLowerCase();
  return ext || null;
}

export function serializeJd(
  row: JdWithRelations,
  usageCount: number,
  extra?: { versions?: unknown; jobPostings?: unknown }
) {
  return {
    id: row.id,
    jdCode: row.jdCode,
    departmentId: row.departmentId,
    designationId: row.designationId,
    title: row.title,
    description: row.description,
    jdFileUrl: fileUrlForJd(row.id, row.jdFileUrl),
    jdFileExt: fileExtFromStored(row.jdFileUrl),
    minExperienceYears: row.minExperienceYears == null ? null : Number(row.minExperienceYears),
    maxExperienceYears: row.maxExperienceYears == null ? null : Number(row.maxExperienceYears),
    salaryPackage: row.salaryPackage,
    status: row.status,
    tags: row.tags.map((t) => t.tag),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    department: row.department,
    designation: row.designation,
    usageCount,
    ...(extra ?? {}),
  };
}

export async function usageCountMap(ids: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (ids.length === 0) return map;
  for (const id of ids) map.set(id, 0);

  const [postings, employees] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { jdId: { in: ids }, deletedAt: null },
      select: { jdId: true },
    }),
    prisma.employee.findMany({
      where: { jdId: { in: ids }, deletedAt: null },
      select: { jdId: true },
    }),
  ]);
  for (const row of postings) {
    if (row.jdId == null) continue;
    map.set(row.jdId, (map.get(row.jdId) ?? 0) + 1);
  }
  for (const row of employees) {
    if (row.jdId == null) continue;
    map.set(row.jdId, (map.get(row.jdId) ?? 0) + 1);
  }
  return map;
}

export async function usageCountFor(id: number): Promise<number> {
  const map = await usageCountMap([id]);
  return map.get(id) ?? 0;
}

export async function findActiveDuplicate(
  departmentId: number,
  designationId: number,
  excludeId?: number
) {
  return prisma.jobDescription.findFirst({
    where: {
      departmentId,
      designationId,
      status: 'Active',
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, jdCode: true, title: true },
  });
}

/** Sentinel row in JobDescriptionSequence — one global counter for JD0001, JD0002, … */
const JD_CODE_SEQUENCE_KEY = 0;

export function formatJdCode(n: number): string {
  return `JD${String(n).padStart(4, '0')}`;
}

export async function allocateJdCode(tx: Prisma.TransactionClient): Promise<string> {
  const seq = await tx.jobDescriptionSequence.upsert({
    where: { departmentId: JD_CODE_SEQUENCE_KEY },
    create: { departmentId: JD_CODE_SEQUENCE_KEY, lastNumber: 0 },
    update: {},
  });

  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const jdCode = formatJdCode(n);
    const taken = await tx.jobDescription.findFirst({
      where: { jdCode },
      select: { id: true },
    });
    if (!taken) {
      await tx.jobDescriptionSequence.update({
        where: { departmentId: JD_CODE_SEQUENCE_KEY },
        data: { lastNumber: n },
      });
      return jdCode;
    }
  }
  throw new Error('Could not allocate a unique JD code');
}

export async function replaceTags(
  tx: Prisma.TransactionClient,
  jobDescriptionId: number,
  tags: string[]
) {
  await tx.jobDescriptionTag.deleteMany({ where: { jobDescriptionId } });
  if (tags.length === 0) return;
  await tx.jobDescriptionTag.createMany({
    data: tags.map((tag) => ({ jobDescriptionId, tag })),
  });
}

export function buildListWhere(params: {
  search?: string;
  departmentId?: number;
  designationId?: number;
  status?: string;
  tags?: string[];
}): Prisma.JobDescriptionWhereInput {
  const { search, departmentId, designationId, status, tags } = params;
  const where: Prisma.JobDescriptionWhereInput = { deletedAt: null };
  if (departmentId) where.departmentId = departmentId;
  if (designationId) where.designationId = designationId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { jdCode: { contains: search } },
      { title: { contains: search } },
    ];
  }
  if (tags && tags.length > 0) {
    where.tags = { some: { tag: { in: tags } } };
  }
  return where;
}

export function parseTagFilters(searchParams: URLSearchParams): string[] {
  const repeated = searchParams.getAll('tags');
  const fromCsv = (searchParams.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const all = [...repeated.flatMap((t) => t.split(',')), ...fromCsv]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(all)];
}
