import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { goalTemplateStatusSchema } from '@/lib/validations/performance';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const existing = await prisma.goalTemplate.findFirst({
      where: { id, companyId: scope.companyId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const parsed = goalTemplateStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const row = await prisma.goalTemplate.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[goal-templates] PATCH status failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update status' }, { status: 500 });
  }
}
