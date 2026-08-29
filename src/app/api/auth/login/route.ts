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

    // Issue JWT (jsonwebtoken — Node runtime)
    const token = signTokenNode({
      userId: user.id,
      roleId: user.role.id,
      roleCode: user.role.code,
    });

    // Create response with user info
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        roleCode: user.role.code,
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
