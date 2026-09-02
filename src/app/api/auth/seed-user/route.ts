/**
 * POST /api/auth/seed-user
 *
 * Bootstraps (or repairs) the one login account needed to reach the Admin
 * UI. Requires POST /api/auth/seed to have been run first — that's what
 * creates the "system-admin" role this route assigns.
 *
 * - If admin@suki.hrms doesn't exist yet: creates it with password
 *   "admin123" and role system-admin.
 * - If it already exists: repairs roleId/isActive/deletedAt only (so an
 *   account that ended up pointing at a role with zero permissions — e.g.
 *   the old test "admin" role, which this app's canonical seed deliberately
 *   never grants anything to — gets fixed back to system-admin). The
 *   password is left untouched on repair, so this is safe to re-run after
 *   you've changed the password via Admin > Users without clobbering it
 *   back to the default.
 *
 * Safe to call multiple times.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST() {
  const role = await prisma.role.findUnique({ where: { code: 'system-admin' } });
  if (!role) {
    return NextResponse.json(
      { error: 'system-admin role not found — call POST /api/auth/seed first, then retry this.' },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: 'admin@suki.hrms' } });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { roleId: role.id, isActive: true, deletedAt: null },
        select: { id: true, email: true, roleId: true },
      })
    : await prisma.user.create({
        data: {
          email: 'admin@suki.hrms',
          passwordHash: await bcrypt.hash('admin123', 10),
          roleId: role.id,
          isActive: true,
        },
        select: { id: true, email: true, roleId: true },
      });

  return NextResponse.json({
    message: existing
      ? 'Repaired existing admin user — role reset to system-admin, account reactivated. Password untouched.'
      : 'Seed user created.',
    user: { id: user.id, email: user.email, roleCode: role.code },
    ...(existing ? {} : { credentials: { email: 'admin@suki.hrms', password: 'admin123' } }),
  });
}
