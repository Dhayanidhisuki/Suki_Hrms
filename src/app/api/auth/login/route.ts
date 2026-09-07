/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Returns: { user: { id, email, roleCode } } + sets httpOnly cookie
 *
 * Validates credentials against the User table (bcrypt compare).
 * On success, issues JWT and sets "hrms-token" httpOnly cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signTokenNode } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email — only active, non-deleted
    const user = await prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        deletedAt: null,
      },
      include: {
        role: { select: { id: true, code: true } },
        company: { select: { isActive: true, deletedAt: true } },
      },
    });

    if (!user) {
      // Response stays generic on purpose; the distinction is logged so the
      // developer can tell "no such user" from "wrong password".
      console.warn(`[login] no active user for ${email}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      console.warn(`[login] password mismatch for ${email}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Company-active gate: checked only after the password has already
    // matched, so an attacker probing emails can't use this message to learn
    // which companies exist/are deactivated — only someone who already knows
    // the correct password sees it.
    if (!user.isSuperAdmin && (!user.company || !user.company.isActive || user.company.deletedAt)) {
      console.warn(`[login] company deactivated for ${email}`);
      return NextResponse.json(
        { error: 'This company account has been deactivated. Contact your platform administrator.' },
        { status: 403 }
      );
    }

    if (!user.isSuperAdmin && !user.role) {
      // Data-integrity guard: every non-superadmin user must have a role.
      console.error(`[login] user ${user.id} has no role and is not superadmin`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue JWT (jsonwebtoken — Node runtime)
    const token = signTokenNode(
      user.isSuperAdmin
        ? { userId: user.id, isSuperAdmin: true }
        : {
            userId: user.id,
            isSuperAdmin: false,
            roleId: user.role!.id,
            roleCode: user.role!.code,
            companyId: user.companyId!,
          }
    );

    // Create response with user info
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        roleCode: user.role?.code ?? null,
      },
    });

    // Set httpOnly cookie
    response.cookies.set('hrms-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    // Most likely: the database is unreachable or the Prisma client is stale.
    // Log the real cause to the server console and return JSON so the browser
    // can always parse the response.
    console.error('[POST /api/auth/login]', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again.'
            : `Server error: ${detail.split('\n')[0]}`,
      },
      { status: 500 }
    );
  }
}
