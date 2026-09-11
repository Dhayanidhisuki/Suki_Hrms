import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

export type GNRAction = 'view' | 'create' | 'edit' | 'delete' | 'authorize' | 'inward' | 'outward' | 'export';

export async function checkGNRPermission(
  request: NextRequest,
  action: GNRAction
): Promise<NextResponse | null> {
  const roleId = request.headers.get('x-role-id');
  if (!roleId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }

  const allowed = await hasPermission(Number(roleId), {
    module: 'visitor',
    submodule: 'gnr',
    action,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient permissions', required: `visitor.gnr.${action}`, roleId: Number(roleId) },
      { status: 403 }
    );
  }

  return null;
}
