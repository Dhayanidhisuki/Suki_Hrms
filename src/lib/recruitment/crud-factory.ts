/**
 * Generic CRUD factory for Recruitment master API routes.
 *
 * Reduces boilerplate for the 13+ recruitment master tables that all follow
 * the same pattern: list (paginated + search), create, get-by-id, update,
 * soft-delete. Masters with special logic (e.g. InterviewProcess with child
 * levels) get custom routes instead.
 *
 * Usage in route.ts:
 *   export const GET = createListHandler('sourcingChannel', sourcingChannelSchema);
 *   export const POST = createHandler('sourcingChannel', sourcingChannelSchema);
 *
 * Usage in [id]/route.ts:
 *   export const GET = createGetHandler('sourcingChannel');
 *   export const PUT = createUpdateHandler('sourcingChannel', schema);
 *   export const DELETE = createDeleteHandler('sourcingChannel');
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import type { ZodSchema } from 'zod';

type ModelName = keyof typeof prisma;

interface ListOptions {
  searchFields?: string[];
  include?: Record<string, boolean>;
  defaultLimit?: number;
  /** Whether the model has a `deletedAt` column for soft-delete filtering. Default: true. */
  softDelete?: boolean;
}

interface CrudOptions extends ListOptions {
  uniqueField?: string; // for duplicate check on create/update (default: 'code')
}

/**
 * The delegate surface this factory uses, narrowed to what the handlers below
 * actually touch.
 *
 * The cast stays — the model is chosen at runtime, and Prisma's per-model
 * delegates are not uniformly indexable — but nothing here needs `any`:
 * arguments are plain objects, rows are returned to the client as-is, and the
 * only field ever read off a row is `deletedAt` for the duplicate check.
 * Keeping the shape honest means a handler that starts reading some other
 * field fails to compile instead of silently trusting `any`.
 */
type RowWithSoftDelete = { deletedAt: Date | null };

type CrudDelegate = {
  findMany(args?: object): Promise<unknown[]>;
  count(args?: object): Promise<number>;
  findUnique(args?: object): Promise<RowWithSoftDelete | null>;
  findFirst(args?: object): Promise<RowWithSoftDelete | null>;
  create(args?: object): Promise<unknown>;
  update(args?: object): Promise<unknown>;
  delete(args?: object): Promise<unknown>;
};

function getModel(name: ModelName): CrudDelegate {
  return prisma[name] as unknown as CrudDelegate;
}

export function createListHandler(model: ModelName, options: ListOptions = {}) {
  const { searchFields = ['code', 'name'], include, defaultLimit = 20, softDelete = true } = options;
  return async function GET(request: NextRequest) {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? String(defaultLimit));
    const search = searchParams.get('search') ?? '';

    // Only two shapes are ever built here, so neither needs to be `any`.
    const where: {
      deletedAt?: null;
      OR?: Array<Record<string, { contains: string }>>;
    } = softDelete ? { deletedAt: null } : {};
    if (search && searchFields.length) {
      where.OR = searchFields.map((f) => ({ [f]: { contains: search } }));
    }

    const m = getModel(model);
    const [data, total] = await Promise.all([
      m.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, ...(include ? { include } : {}) }),
      m.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  };
}

export function createHandler(model: ModelName, schema: ZodSchema, options: CrudOptions = {}) {
  const { uniqueField, include } = options;
  return async function POST(request: NextRequest) {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const m = getModel(model);
    if (uniqueField && (parsed.data as Record<string, unknown>)[uniqueField]) {
      const existing = await m.findUnique({ where: { [uniqueField]: (parsed.data as Record<string, unknown>)[uniqueField] } });
      if (existing && existing.deletedAt === null) {
        return NextResponse.json({ error: `${uniqueField} already exists` }, { status: 409 });
      }
    }

    const record = await m.create({ data: parsed.data, ...(include ? { include } : {}) });
    return NextResponse.json(record, { status: 201 });
  };
}

export function createGetHandler(model: ModelName, options: ListOptions = {}) {
  const { include, softDelete = true } = options;
  return async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const { id } = await params;
    const m = getModel(model);
    const record = await m.findFirst({
      where: softDelete ? { id: parseInt(id), deletedAt: null } : { id: parseInt(id) },
      ...(include ? { include } : {}),
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(record);
  };
}

export function createUpdateHandler(model: ModelName, schema: ZodSchema, options: CrudOptions = {}) {
  const { uniqueField, include } = options;
  return async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const m = getModel(model);
    if (uniqueField && (parsed.data as Record<string, unknown>)[uniqueField]) {
      const existing = await m.findFirst({
        where: { [uniqueField]: (parsed.data as Record<string, unknown>)[uniqueField], NOT: { id: parseInt(id) } },
      });
      if (existing && existing.deletedAt === null) {
        return NextResponse.json({ error: `${uniqueField} already exists` }, { status: 409 });
      }
    }

    const record = await m.update({
      where: { id: parseInt(id) },
      data: parsed.data,
      ...(include ? { include } : {}),
    });
    return NextResponse.json(record);
  };
}

export function createDeleteHandler(model: ModelName, options: ListOptions = {}) {
  const { softDelete = true } = options;
  return async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const { id } = await params;
    const m = getModel(model);
    if (softDelete) {
      await m.update({
        where: { id: parseInt(id) },
        data: { deletedAt: new Date(), isActive: false },
      });
      return NextResponse.json({ message: 'Soft-deleted' }, { status: 200 });
    }
    await m.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ message: 'Deleted' }, { status: 200 });
  };
}
