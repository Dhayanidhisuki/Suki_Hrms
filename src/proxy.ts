/**
 * Next.js Proxy — JWT verification + route protection.
 *
 * Uses jose (Edge-compatible) for token verification.
 *
 * Protected route groups:
 * - /api/protected/*  — existing test route (JWT + permission in handler)
 * - /api/masters/*    — master setup API routes (JWT here, permission in handler)
 * - /masters/*        — master setup UI pages (JWT check, redirect to / if no token)
 *
 * Permission DB checks happen in route handlers (Node runtime),
 * not in middleware (Edge runtime can't access Prisma).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyTokenJose } from '@/lib/jwt';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  const isApiRoute = pathname.startsWith('/api/protected/') || pathname.startsWith('/api/masters/');
  const isUiRoute = pathname.startsWith('/masters/');

  if (!isApiRoute && !isUiRoute) {
    return NextResponse.next();
  }

  // Extract token — API routes use Authorization header, UI routes use cookie
  let token: string | null = null;

  if (isApiRoute) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  } else if (isUiRoute) {
    token = request.cookies.get('hrms-token')?.value ?? null;
  }

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }
    // UI route — redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token (jose — Edge compatible)
  const payload = await verifyTokenJose(token);
  if (!payload) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Add user info to request headers for downstream route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(payload.userId));
  requestHeaders.set('x-role-id', String(payload.roleId));
  requestHeaders.set('x-role-code', payload.roleCode);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/api/protected/:path*',
    '/api/masters/:path*',
    '/masters/:path*',
  ],
};
