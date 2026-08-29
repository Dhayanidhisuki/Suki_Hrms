/**
 * POST /api/auth/seed-user
 *
 * Creates a test admin user for login testing.
 * Email: admin@suki.hrms  Password: admin123
 *
 * Also ensures the "admin" role exists.
 * Safe to call multiple times — uses upsert.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST() {
  // 1. Ensure admin role exists
  const role = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      code: 'admin',
      name: 'Administrator',
      description: 'Full access admin role',
    },
  });

  // 2. Hash the default password
  const passwordHash = await bcrypt.hash('admin123', 10);

  // 3. Upsert the admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@suki.hrms' },
    // Re-seeding must REPAIR an existing row, otherwise a user created with a
    // stale hash (or later deactivated) can never sign in again.
    update: {
      passwordHash,
      roleId: role.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'admin@suki.hrms',
      passwordHash,
      roleId: role.id,
      isActive: true,
    },
    select: { id: true, email: true, roleId: true },
  });

  return NextResponse.json({
    message: 'Seed user created',
    user: {
      id: user.id,
      email: user.email,
      roleCode: role.code,
    },
    credentials: {
      email: 'admin@suki.hrms',
      password: 'admin123',
    },
  });
}
