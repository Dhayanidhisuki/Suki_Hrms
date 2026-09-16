/**
 * Route-handler helpers shared by src/app/api/platform/**.
 *
 * - resolveActor: builds the PlatformActor from the auth headers the proxy
 *   injects, looking up the caller's employee (not every user is one).
 * - isWorkflowAdmin: platform.workflow.admin check for the caller's role.
 * - errorResponse: maps WorkflowError / SnapshotError / zod / Prisma errors
 *   to { error } responses without leaking a Prisma error as a 500.
 */

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/rbac';
import type { PlatformActor } from '../contracts';
import { SnapshotError } from '../snapshot/service';
import { WorkflowError } from './types';

export async function resolveActor(request: NextRequest): Promise<PlatformActor & { companyId: number }> {
  const userId = Number(request.headers.get('x-user-id'));
  const companyId = Number(request.headers.get('x-company-id'));
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  let employeeId: number | null = null;
  if (Number.isFinite(userId) && userId > 0 && Number.isFinite(companyId)) {
    const emp = await prisma.employee.findFirst({ where: { userId, companyId, deletedAt: null }, select: { id: true } });
    employeeId = emp?.id ?? null;
  }
  return { userId: Number.isFinite(userId) && userId > 0 ? userId : null, employeeId, source: 'user', ipAddress: ip, companyId };
}

export async function isWorkflowAdmin(request: NextRequest): Promise<boolean> {
  const roleId = Number(request.headers.get('x-role-id'));
  if (!Number.isFinite(roleId) || roleId <= 0) return false;
  return hasPermission(roleId, { module: 'platform', submodule: 'workflow', action: 'admin' });
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof WorkflowError || err instanceof SnapshotError) {
    return NextResponse.json({ error: err.message, code: err.code, ...(err instanceof WorkflowError && err.details ? { details: err.details } : {}) }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'A record with the same unique key already exists' }, { status: 409 });
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('[platform/api] prisma error', err.code, err.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[platform/api] prisma validation error', err.message);
    return NextResponse.json({ error: 'Invalid data for database operation' }, { status: 400 });
  }
  console.error('[platform/api] unexpected error', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function queryObject(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}
