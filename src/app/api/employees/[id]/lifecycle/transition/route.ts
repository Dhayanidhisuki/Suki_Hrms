/**
 * POST /api/employees/[id]/lifecycle/transition — perform one §8.2 lifecycle
 * transition. Body: { toState, trigger?, effectiveDate?, reason?, referenceNo?, rehireTo? }.
 * 409 when the table does not permit from → to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { canSeeEmployee, scopeContextFromHeaders } from '@/lib/employee/scope';
import { transition, TransitionError } from '@/lib/employee/lifecycle';
import { lifecycleTransitionSchema } from '@/lib/validations/employee-master';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkSpecificPermission(request, 'employee.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const employeeId = parseInt(id);
  const ctx = scopeContextFromHeaders(request.headers);
  if (!(await canSeeEmployee(ctx.userId, scope.companyId, employeeId, { isSuperAdmin: ctx.isSuperAdmin }))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const parsed = lifecycleTransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await transition(scope.companyId, employeeId, body.toState, {
      trigger: body.trigger ?? 'HR_ACTION',
      effectiveDate: body.effectiveDate,
      reason: body.reason ?? null,
      referenceNo: body.referenceNo ?? null,
      rehireTo: body.rehireTo,
      actor: { userId: ctx.userId || null, source: 'user' },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TransitionError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Transition failed' }, { status: 400 });
  }
}
