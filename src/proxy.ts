/**
 * Next.js Proxy — JWT verification + route protection.
 *
 * Uses jose (Edge-compatible) for token verification.
 *
 * Protected route groups:
 * - /api/protected/*     — existing test route (JWT + permission in handler)
 * - /api/masters/*       — master setup API routes (JWT here, permission in handler)
 * - /api/org-options     — org master dropdown data (JWT here, permission in handler)
 * - /api/admin/*         — user/role/permission admin API routes (JWT here, permission in handler)
 * - /api/workforce/*     — attendance/leave API routes (JWT here, permission + company-scope in handler)
 * - /api/payroll/*       — payroll run API routes (JWT here, permission + company-scope in handler)
 * - /api/reports/*       — reporting API routes (JWT here, permission + company-scope in handler)
 * - /api/bonus/*         — bonus management API routes (JWT here, permission + company-scope in handler)
 * - /api/gratuity/*      — gratuity management API routes (JWT here, permission + company-scope in handler)
 * - /masters/*           — master setup UI pages (JWT check, redirect to / if no token)
 * - /admin/*             — administration UI pages (JWT check, redirect to / if no token)
 * - /workforce/*         — attendance/leave UI pages (JWT check, redirect to / if no token)
 * - /payroll/*           — payroll run UI pages (JWT check, redirect to / if no token)
 * - /reports/*           — reporting UI pages (JWT check, redirect to / if no token)
 *
 * Permission DB checks happen in route handlers (Node runtime),
 * not in middleware (Edge runtime can't access Prisma).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyTokenJose } from '@/lib/jwt';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  const isApiRoute =
    pathname.startsWith('/api/protected/') ||
    pathname.startsWith('/api/masters/') ||
    pathname.startsWith('/api/employees') ||
    pathname.startsWith('/api/uploads') ||
    pathname.startsWith('/api/org-options') ||
    pathname.startsWith('/api/admin/') ||
    pathname.startsWith('/api/superadmin/') ||
    pathname.startsWith('/api/workforce/') ||
    pathname.startsWith('/api/payroll/') ||
    pathname.startsWith('/api/reports/') ||
    pathname.startsWith('/api/bonus/') ||
    pathname.startsWith('/api/gratuity/') ||
    pathname === '/api/auth/me';
  const isUiRoute =
    pathname.startsWith('/masters/') ||
    pathname.startsWith('/employees') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/superadmin/') ||
    pathname.startsWith('/workforce/') ||
    pathname.startsWith('/payroll/') ||
    pathname.startsWith('/reports/');

  if (!isApiRoute && !isUiRoute) {
    return NextResponse.next();
  }

  // Extract token — API routes prefer the Authorization header (for
  // non-browser/API clients) but fall back to the session cookie, since
  // browser fetch() calls from our own pages send it automatically and
  // don't set an Authorization header. UI routes always use the cookie.
  let token: string | null = null;

  if (isApiRoute) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = request.cookies.get('hrms-token')?.value ?? null;
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
  requestHeaders.set('x-is-superadmin', String(payload.isSuperAdmin === true));
  if (payload.roleId !== undefined) requestHeaders.set('x-role-id', String(payload.roleId));
  if (payload.roleCode !== undefined) requestHeaders.set('x-role-code', payload.roleCode);
  if (payload.companyId !== undefined) requestHeaders.set('x-company-id', String(payload.companyId));

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/api/protected/:path*',
    '/api/masters/:path*',
    '/masters/:path*',
    '/api/employees/:path*',
    '/api/employees',
    '/api/uploads/:path*',
    '/api/uploads',
    '/employees/:path*',
    '/employees',
    '/api/org-options',
    '/api/admin/:path*',
    '/admin/:path*',
    '/api/superadmin/:path*',
    '/superadmin/:path*',
    '/api/workforce/:path*',
    '/workforce/:path*',
    '/api/payroll/:path*',
    '/payroll/:path*',
    '/api/reports/:path*',
    '/reports/:path*',
    '/api/bonus/:path*',
    '/api/gratuity/:path*',
    '/api/auth/me',
  ],
};
