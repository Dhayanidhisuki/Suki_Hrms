/**
 * GET /api/auth/health          → why login is failing, in plain JSON
 * GET /api/auth/health?repair=1 → also (re)create admin@suki.hrms / admin123
 *
 * Development only — returns 404 when NODE_ENV is production, so this never
 * ships as a credential oracle.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const EMAIL = 'admin@suki.hrms';
const PASSWORD = 'admin123';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const repair = new URL(request.url).searchParams.get('repair') === '1';

  try {
    let repaired: string | null = null;

    if (repair) {
      const role = await prisma.role.upsert({
        where: { code: 'admin' },
        update: {},
        create: { code: 'admin', name: 'Administrator', description: 'Full access admin role' },
      });
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      const user = await prisma.user.upsert({
        where: { email: EMAIL },
        update: { passwordHash, roleId: role.id, isActive: true, deletedAt: null },
        create: { email: EMAIL, passwordHash, roleId: role.id, isActive: true },
        select: { id: true },
      });
      repaired = `user #${user.id} set to ${EMAIL} / ${PASSWORD}`;
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, isActive: true, deletedAt: true, roleId: true, passwordHash: true },
      orderBy: { id: 'asc' },
    });

    const target = users.find((user) => user.email === EMAIL);

    return NextResponse.json({
      database: 'connected',
      roleCount: await prisma.role.count(),
      userCount: users.length,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        deletedAt: user.deletedAt,
        roleId: user.roleId,
        hash: `${user.passwordHash.slice(0, 7)}… (${user.passwordHash.length} chars)`,
      })),
      seedUser: target
        ? {
            exists: true,
            // The login query filters on these two — if either fails the row is invisible.
            visibleToLoginQuery: target.isActive && target.deletedAt === null,
            passwordMatchesAdmin123: await bcrypt.compare(PASSWORD, target.passwordHash),
          }
        : { exists: false, hint: 'Open this URL with ?repair=1 to create it.' },
      repaired,
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
