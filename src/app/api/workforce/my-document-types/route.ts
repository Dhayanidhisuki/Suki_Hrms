/**
 * GET /api/workforce/my-document-types
 *   The active EMPLOYEE-facing document types, for the upload picker on
 *   the ESS Documents page. Any authenticated employee may browse this —
 *   it is a picklist of type names/rules, not personal data — unlike
 *   /api/platform/document/types (platform.document.admin-gated, the full
 *   HR configuration screen for creating/editing types).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });
  }
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const data = await prisma.platformDocumentType.findMany({
    where: { companyId: scope.companyId, appliesToEntity: 'EMPLOYEE', isActive: true },
    select: {
      code: true,
      name: true,
      category: true,
      mandatoryFlag: true,
      expiryRequired: true,
      allowedFileTypes: true,
      maxFileSizeMb: true,
      maxFileCount: true,
    },
    orderBy: { code: 'asc' },
  });

  return NextResponse.json({ data });
}
