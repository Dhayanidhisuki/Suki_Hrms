/**
 * GET /api/employees/[id]/lifecycle — current lifecycle state (BRD 01 §8),
 *     the targets the §8.2 table permits from it, and the transition history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { canSeeEmployee, scopeContextFromHeaders } from '@/lib/employee/scope';
import { currentLifecycle, lifecycleHistory } from '@/lib/employee/lifecycle';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const employeeId = parseInt(id);
  const ctx = scopeContextFromHeaders(request.headers);
  if (!(await canSeeEmployee(ctx.userId, scope.companyId, employeeId, { isSuperAdmin: ctx.isSuperAdmin }))) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const current = await currentLifecycle(scope.companyId, employeeId);
  if (!current) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  const history = await lifecycleHistory(scope.companyId, employeeId);
  return NextResponse.json({ ...current, history });
}
