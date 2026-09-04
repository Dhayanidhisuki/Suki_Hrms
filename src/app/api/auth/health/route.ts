/**
 * GET /api/auth/health   → why login is failing, in plain JSON
 *
 * Development only — returns 404 when NODE_ENV is production, so this never
 * ships as a credential oracle. Read-only diagnostic — to (re)create the
 * first login, use POST /api/auth/seed-superadmin (before any superadmin
 * exists) or the "Create / Reset" admin-login action in Superadmin >
 * Companies (once one does).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        deletedAt: true,
        isSuperAdmin: true,
        companyId: true,
        roleId: true,
        passwordHash: true,
      },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({
      database: 'connected',
      companyCount: await prisma.company.count(),
      roleCount: await prisma.role.count(),
      userCount: users.length,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        isSuperAdmin: user.isSuperAdmin,
        companyId: user.companyId,
        roleId: user.roleId,
        hash: `${user.passwordHash.slice(0, 7)}… (${user.passwordHash.length} chars)`,
      })),
      hint: users.some((u) => u.isSuperAdmin)
        ? undefined
        : 'No superadmin exists yet — POST /api/auth/seed-superadmin to bootstrap one.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        database: 'error',
        message: error instanceof Error ? error.message.split('\n')[0] : 'Unknown error',
        hint: 'Prisma could not reach SQL Server, or the client is stale — try `npx prisma generate`.',
      },
      { status: 500 },
    );
  }
}
