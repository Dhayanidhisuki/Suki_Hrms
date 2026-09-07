/**
 * POST /api/auth/seed-superadmin
 *
 * Bootstraps the platform's first superadmin login. Superadmin is the
 * chicken-and-egg entry point into the whole company-scoped RBAC system —
 * nothing else can create it, since every other account (company-admin,
 * hr-admin, hr-viewer, ...) is created BY a superadmin via
 * POST /api/superadmin/companies/[id]/bootstrap-admin.
 *
 * Refuses to run if a superadmin already exists (isSuperAdmin: true), so
 * this can't be used to mint extra superadmin accounts once one is set up —
 * do that from Admin/Superadmin UI instead once one exists. Safe to call
 * repeatedly before that point.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const SUPERADMIN_EMAIL = 'superadmin@suki.hrms';
const SUPERADMIN_DEFAULT_PASSWORD = 'superadmin123';

export async function POST() {
  const existing = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (existing) {
    return NextResponse.json(
      {
        error: 'A superadmin already exists — this route only bootstraps the first one.',
        existingEmail: existing.email,
      },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email: SUPERADMIN_EMAIL,
      passwordHash: await bcrypt.hash(SUPERADMIN_DEFAULT_PASSWORD, 10),
      isSuperAdmin: true,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  return NextResponse.json({
    message: 'Superadmin created.',
    user,
    credentials: { email: SUPERADMIN_EMAIL, password: SUPERADMIN_DEFAULT_PASSWORD },
  });
}
