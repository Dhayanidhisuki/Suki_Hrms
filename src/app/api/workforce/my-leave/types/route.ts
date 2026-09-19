/**
 * GET /api/workforce/my-leave/types
 *   Active leave types available for self-service application. Any
 *   authenticated employee may view this catalog.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const types = await prisma.leaveMaster.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ data: types });
}
