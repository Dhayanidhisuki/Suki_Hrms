/**
 * GET /api/masters/employee-code-policy — the company's employee-code
 *     policy (prefix / width / nextSequence) plus a preview of the next code.
 *     Created from the existing codes on first read (BRD 01 §7.2).
 * PUT /api/masters/employee-code-policy — HR Admin changes prefix / width;
 *     applies only to codes generated afterwards (§7.3 rule 4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { employeeCodePolicySchema } from '@/lib/validations/employee-master';
import { getOrCreateCodePolicy, peekNextEmployeeCode, updateCodePolicy } from '@/lib/employee/codePolicy';
import { audit } from '@/lib/platform/audit/service';

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const policy = await getOrCreateCodePolicy(scope.companyId);
  const nextCode = await peekNextEmployeeCode(scope.companyId);
  return NextResponse.json({ ...policy, nextCode });
}

export async function PUT(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'masters.org.edit');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const parsed = employeeCodePolicySchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const before = await getOrCreateCodePolicy(scope.companyId);
  let after;
  try {
    after = await updateCodePolicy(scope.companyId, parsed.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 400 });
  }

  await audit({
    companyId: scope.companyId,
    entityType: 'EmployeeCodePolicy',
    entityId: after.id,
    action: 'UPDATE',
    actor: { userId: Number(request.headers.get('x-user-id')) || null },
    before: { prefix: before.prefix, width: before.width, nextSequence: before.nextSequence },
    after: { prefix: after.prefix, width: after.width, nextSequence: after.nextSequence },
  });

  const nextCode = await peekNextEmployeeCode(scope.companyId);
  return NextResponse.json({ ...after, nextCode });
}
