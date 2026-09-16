/**
 * Resolve the calling user into a PlatformActor plus the role code and
 * employee id the document access rules need. There is no employee id in
 * the session, so the employee is looked up by userId within the company.
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { PlatformActor } from '../contracts';
import type { DocumentCaller } from './service';

export type ResolvedActor = { actor: PlatformActor; caller: DocumentCaller };

export async function resolveDocumentActor(request: NextRequest, companyId: number): Promise<ResolvedActor> {
  const rawUser = request.headers.get('x-user-id');
  const userId = rawUser && !Number.isNaN(Number(rawUser)) ? Number(rawUser) : null;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;

  let employeeId: number | null = null;
  let roleCode: string | null = null;
  if (userId) {
    const [employee, user] = await Promise.all([
      prisma.employee.findFirst({ where: { userId, companyId, deletedAt: null }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { code: true } } } }),
    ]);
    employeeId = employee?.id ?? null;
    roleCode = user?.role?.code ?? null;
  }

  return {
    actor: { userId, employeeId, source: 'user', ipAddress },
    caller: { userId, employeeId, roleCode },
  };
}
