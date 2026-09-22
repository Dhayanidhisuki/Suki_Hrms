import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { getCompanyId } from '@/lib/companyScope';
import { allocateTemplateCode } from '@/lib/performance/templateCode';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Duplicate a template as a new Draft. This is the supported path for
 * revising a template that already has accepted/pending assignments.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const permErr = await checkMasterPermission(request);
    if (permErr) return permErr;
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const id = Number((await params).id);

    const source = await prisma.goalTemplate.findFirst({
      where: { id, companyId: scope.companyId },
      include: { kras: { include: { kpis: true }, orderBy: { id: 'asc' } } },
    });
    if (!source) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const createdByUserId = Number(request.headers.get('x-user-id')) || null;
    const code = await allocateTemplateCode(scope.companyId);

    const row = await prisma.goalTemplate.create({
      data: {
        companyId: scope.companyId,
        code,
        name: source.name.startsWith('Copy of ') ? source.name : `Copy of ${source.name}`,
        description: source.description,
        departmentId: source.departmentId,
        designationId: source.designationId,
        jobRole: source.jobRole,
        status: 'DRAFT',
        createdByUserId,
        clonedFromId: source.id,
        kras: {
          create: source.kras.map((k) => ({
            kraId: k.kraId,
            weightage: k.weightage,
            // Carry the source template's snapshot rather than re-reading the
            // master, so a clone is a faithful copy of what was cloned.
            kraCode: k.kraCode,
            kraName: k.kraName,
            kraCategory: k.kraCategory,
            kpis: {
              create: k.kpis.map((p) => ({
                kpiId: p.kpiId,
                description: p.description,
                measurementType: p.measurementType,
                unit: p.unit,
                target: p.target,
                minThreshold: p.minThreshold,
                maxTarget: p.maxTarget,
                weightage: p.weightage,
                frequency: p.frequency,
              })),
            },
          })),
        },
      },
      include: { kras: { include: { kpis: true } } },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[goal-templates] clone failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to clone template' }, { status: 500 });
  }
}
