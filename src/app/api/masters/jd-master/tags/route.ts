/**
 * GET /api/jd-master/tags — distinct tags for the skills filter / suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const rows = await prisma.jobDescriptionTag.groupBy({
    by: ['tag'],
    orderBy: { tag: 'asc' },
  });
  return NextResponse.json({ data: rows.map((r) => r.tag) });
}
