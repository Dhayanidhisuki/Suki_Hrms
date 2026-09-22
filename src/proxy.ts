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
 * - /api/stats/*         — dashboard KPI counts (JWT here, permission + company-scope in handler)
 * - /api/workforce/*     — attendance/leave API routes (JWT here, permission + company-scope in handler)
 * - /api/biometric/*     — biometric attendance import API routes (JWT here, permission + company-scope in handler)
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
    pathname.startsWith('/api/stats/') ||
    pathname.startsWith('/api/superadmin/') ||
    pathname.startsWith('/api/workforce/') ||
    pathname.startsWith('/api/biometric/') ||
    pathname.startsWith('/api/payroll/') ||
    pathname.startsWith('/api/reports/') ||
    pathname.startsWith('/api/bonus/') ||
    pathname.startsWith('/api/gratuity/') ||
    pathname.startsWith('/api/visitor/') ||
    pathname.startsWith('/api/manager/') ||
    pathname.startsWith('/api/jd-master') ||
    pathname.startsWith('/api/recruitment/') ||
    pathname.startsWith('/api/skill-levels') ||
    pathname.startsWith('/api/competencies') ||
    pathname.startsWith('/api/competency-requirements') ||
    pathname.startsWith('/api/skill-matrix') ||
    pathname.startsWith('/api/training-plans') ||
    pathname.startsWith('/api/monthly-training-plans') ||
    pathname.startsWith('/api/training-plan-lines') ||
    pathname.startsWith('/api/training-schedules') ||
    pathname.startsWith('/api/training-programs') ||
    pathname.startsWith('/api/trainers') ||
    pathname.startsWith('/api/training-venues') ||
    pathname.startsWith('/api/training-needs') ||
    pathname.startsWith('/api/training-nominations') ||
    pathname.startsWith('/api/training-attendance') ||
    pathname.startsWith('/api/training-feedback') ||
    pathname.startsWith('/api/training-history') ||
    pathname.startsWith('/api/question-bank') ||
    pathname.startsWith('/api/question-bank-groups') ||
    pathname.startsWith('/api/assessments') ||
    pathname.startsWith('/api/assessment-attempts') ||
    pathname.startsWith('/api/training-effectiveness') ||
    pathname.startsWith('/api/my-trainings') ||
    pathname.startsWith('/api/training-dashboard') ||
    pathname.startsWith('/api/training-policies') ||
    pathname.startsWith('/api/training-budgets') ||
    pathname.startsWith('/api/induction-programs') ||
    pathname.startsWith('/api/induction-assignments') ||
    pathname.startsWith('/api/ojt-assignments') ||
    pathname.startsWith('/api/training-checklists') ||
    pathname.startsWith('/api/training-compliance') ||
    pathname.startsWith('/api/training-certificates') ||
    pathname.startsWith('/api/skills') ||
    pathname.startsWith('/api/skill-requirements') ||
    pathname.startsWith('/api/employee-skill-levels') ||
    pathname.startsWith('/api/training-documents') ||
    pathname.startsWith('/api/external-trainings') ||
    pathname.startsWith('/api/idp') ||
    pathname.startsWith('/api/training-recommendations') ||
    pathname.startsWith('/api/training-reports') ||
    pathname.startsWith('/api/training-cost-items') ||
    pathname.startsWith('/api/training-mentors') ||
    pathname.startsWith('/api/training-resources') ||
    pathname.startsWith('/api/training-providers') ||
    pathname.startsWith('/api/certification-masters') ||
    pathname.startsWith('/api/training-methods') ||
    pathname.startsWith('/api/platform/') ||
    pathname.startsWith('/api/letters') ||
    pathname.startsWith('/api/ess/') ||
    pathname.startsWith('/api/performance/') ||
    pathname === '/api/auth/me';
  const isUiRoute =
    pathname.startsWith('/masters/') ||
    pathname.startsWith('/employees') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/superadmin/') ||
    pathname.startsWith('/workforce/') ||
    pathname.startsWith('/payroll/') ||
    pathname.startsWith('/reports/') ||
    pathname.startsWith('/visitor/') ||
    pathname.startsWith('/manager/') ||
    pathname.startsWith('/recruitment/') ||
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/learning/') ||
    pathname.startsWith('/documents') ||
    pathname.startsWith('/ess') ||
    pathname.startsWith('/performance/') ||
    pathname.startsWith('/approvals');

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
    '/api/stats/:path*',
    '/api/superadmin/:path*',
    '/superadmin/:path*',
    '/api/workforce/:path*',
    '/workforce/:path*',
    '/api/biometric/:path*',
    '/api/payroll/:path*',
    '/payroll/:path*',
    '/api/reports/:path*',
    '/reports/:path*',
    '/api/bonus/:path*',
    '/api/gratuity/:path*',
    '/api/visitor/:path*',
    '/visitor/:path*',
    '/api/manager/:path*',
    '/manager/:path*',
    '/api/jd-master/:path*',
    '/api/jd-master',
    '/api/performance/:path*',
    '/performance/:path*',
    '/api/recruitment/:path*',
    '/recruitment/:path*',
    '/api/platform/:path*',
    '/api/letters',
    '/api/letters/:path*',
    '/api/ess/:path*',
    '/documents',
    '/documents/:path*',
    '/ess/:path*',
    '/dashboard/:path*',
    '/api/skill-levels/:path*',
    '/api/skill-levels',
    '/api/competencies/:path*',
    '/api/competencies',
    '/api/competency-requirements/:path*',
    '/api/competency-requirements',
    '/api/skill-matrix',
    '/api/training-plans/:path*',
    '/api/training-plans',
    '/api/monthly-training-plans/:path*',
    '/api/monthly-training-plans',
    '/api/training-plan-lines/:path*',
    '/api/training-plan-lines',
    '/api/training-schedules/:path*',
    '/api/training-schedules',
    '/api/training-programs/:path*',
    '/api/training-programs',
    '/api/trainers/:path*',
    '/api/trainers',
    '/api/training-venues/:path*',
    '/api/training-venues',
    '/api/training-needs/:path*',
    '/api/training-needs',
    '/api/training-nominations/:path*',
    '/api/training-nominations',
    '/api/training-attendance/:path*',
    '/api/training-attendance',
    '/api/training-feedback',
    '/api/training-history',
    '/api/question-bank-groups/:path*',
    '/api/question-bank-groups',
    '/api/question-bank/:path*',
    '/api/question-bank',
    '/api/assessments/:path*',
    '/api/assessments',
    '/api/assessment-attempts',
    '/api/training-effectiveness/:path*',
    '/api/training-effectiveness',
    '/api/my-trainings/:path*',
    '/api/my-trainings',
    '/ess/my-trainings',
    '/api/training-dashboard',
    '/api/training-policies/:path*',
    '/api/training-policies',
    '/api/training-budgets/:path*',
    '/api/training-budgets',
    '/api/induction-programs/:path*',
    '/api/induction-programs',
    '/api/induction-assignments/:path*',
    '/api/induction-assignments',
    '/api/ojt-assignments/:path*',
    '/api/ojt-assignments',
    '/api/training-checklists/:path*',
    '/api/training-checklists',
    '/api/training-compliance',
    '/api/training-certificates/:path*',
    '/api/training-certificates',
    '/api/skills/:path*',
    '/api/skills',
    '/api/skill-requirements/:path*',
    '/api/skill-requirements',
    '/api/employee-skill-levels',
    '/api/training-documents/:path*',
    '/api/training-documents',
    '/api/external-trainings/:path*',
    '/api/external-trainings',
    '/api/idp/:path*',
    '/api/idp',
    '/api/training-recommendations',
    '/api/training-reports',
    '/api/training-cost-items/:path*',
    '/api/training-cost-items',
    '/api/training-mentors/:path*',
    '/api/training-mentors',
    '/api/training-resources/:path*',
    '/api/training-resources',
    '/api/training-providers/:path*',
    '/api/training-providers',
    '/api/certification-masters/:path*',
    '/api/certification-masters',
    '/api/training-methods/:path*',
    '/api/training-methods',
    '/api/platform/audit',
    '/learning/:path*',
    '/approvals/:path*',
    '/api/auth/me',
  ],
};
