import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { bulkAssignSchema } from '@/lib/validations/performance';
import { canManageGoalsFor, isGoalOwner, resolveActor } from '@/lib/performance/access';
import { canReissueAssignment, goalSetCreateFromTemplate } from '@/lib/performance/copyTemplate';
import { findIneffectiveKras, validateWeightages } from '@/lib/performance/weightage';

/**
 * Bulk goal assignment — copy an Active template onto one or more employees
 * for a cycle. The KRA/KPI content is snapshotted; the set lands in
 * PENDING_ACCEPTANCE so the employee can accept or return it.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const cycleId = sp.get('cycleId');
    const status = sp.get('status');
    const forEmployee = sp.get('employeeId');
    const departmentId = sp.get('departmentId');

    let employeeFilter: object = {};
    if (forEmployee) {
      const employeeId = Number(forEmployee);
      const mayView =
        isGoalOwner(actor, employeeId) || (await canManageGoalsFor(actor, scope.companyId, employeeId));
      if (!mayView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      employeeFilter = { employeeId };
    } else if (!actor.isHr) {
      const reports = await prisma.employee.findMany({
        where: {
          companyId: scope.companyId,
          OR: [{ reportingManagerId: actor.employeeId }, { secondReportingManagerId: actor.employeeId }],
        },
        select: { id: true },
      });
      employeeFilter = { employeeId: { in: [...reports.map((r) => r.id), actor.employeeId ?? -1] } };
    }

    if (departmentId) {
      const inDept = await prisma.employee.findMany({
        where: {
          companyId: scope.companyId,
          deletedAt: null,
          jobInfos: { some: { effectiveTo: null, departmentId: Number(departmentId) } },
        },
        select: { id: true },
      });
      const deptIds = new Set(inDept.map((e) => e.id));
      if ('employeeId' in employeeFilter) {
        const existing = employeeFilter as { employeeId: number | { in: number[] } };
        if (typeof existing.employeeId === 'number') {
          if (!deptIds.has(existing.employeeId)) employeeFilter = { employeeId: -1 };
        } else {
          employeeFilter = { employeeId: { in: existing.employeeId.in.filter((id) => deptIds.has(id)) } };
        }
      } else {
        employeeFilter = { employeeId: { in: [...deptIds] } };
      }
    }

    const sets = await prisma.employeeGoalSet.findMany({
      where: {
        companyId: scope.companyId,
        ...employeeFilter,
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        cycle: { select: { id: true, code: true, name: true, status: true } },
        _count: { select: { kras: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const employees = await prisma.employee.findMany({
      where: { id: { in: sets.map((s) => s.employeeId) } },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
    });
    const byEmp = new Map(employees.map((e) => [e.id, e]));

    const templateIds = [...new Set(sets.map((s) => s.templateId).filter((id): id is number => id != null))];
    const templates = templateIds.length
      ? await prisma.goalTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const byTpl = new Map(templates.map((t) => [t.id, t]));

    const data = sets.map((s) => ({
      ...s,
      employee: byEmp.get(s.employeeId) ?? null,
      template: s.templateId != null ? (byTpl.get(s.templateId) ?? null) : null,
    }));

    return NextResponse.json({
      data,
      pagination: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    });
  } catch (err) {
    console.error('[goal-assignment] GET failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load assignments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = getCompanyId(request);
    if ('error' in scope) return scope.error;
    const actor = await resolveActor(request, scope.companyId);
    if (!actor) return NextResponse.json({ error: 'Unauthorized — authentication required' }, { status: 401 });

    const parsed = bulkAssignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { cycleId, templateId, employeeIds } = parsed.data;
    const uniqueIds = [...new Set(employeeIds)];

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: scope.companyId },
    });
    if (!cycle) return NextResponse.json({ error: 'Performance cycle not found' }, { status: 404 });
    if (cycle.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Goals can only be assigned in an Active cycle (this one is ${cycle.status})` },
        { status: 409 }
      );
    }

    const template = await prisma.goalTemplate.findFirst({
      where: { id: templateId, companyId: scope.companyId },
      include: { kras: { include: { kra: true, kpis: { include: { kpi: true } } }, orderBy: { id: 'asc' } } },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (template.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only an Active template can be assigned' }, { status: 409 });
    }
    if (template.kras.length === 0) {
      return NextResponse.json({ error: 'This template has no KRAs' }, { status: 409 });
    }

    // BRD §8 effective dating, checked against the cycle the goals are for —
    // a KRA whose window closed before the cycle starts must not be assigned
    // into it, even if the template was valid when it was built.
    const expired = findIneffectiveKras(
      template.kras.map((k) => ({
        code: k.kra.code,
        effectiveFrom: k.kra.effectiveFrom,
        effectiveTo: k.kra.effectiveTo,
      })),
      cycle.startDate
    );
    if (expired.length) {
      return NextResponse.json(
        {
          error: `This template has KRAs that are not effective for ${cycle.code}: ${expired.join(', ')}. Clone it and replace them.`,
        },
        { status: 409 }
      );
    }

    const weight = validateWeightages(
      template.kras.map((k) => ({
        label: k.kra.code,
        weightage: Number(k.weightage),
        kpis: k.kpis.map((p) => ({ label: p.kpi.code, weightage: Number(p.weightage) })),
      }))
    );
    if (!weight.valid) {
      return NextResponse.json({ error: 'Weightage validation failed', details: weight.errors }, { status: 400 });
    }

    const assigned: number[] = [];
    const skipped: Array<{ employeeId: number; reason: string }> = [];
    const now = new Date();
    const lines = goalSetCreateFromTemplate(template, cycle);

    for (const employeeId of uniqueIds) {
      if (!(await canManageGoalsFor(actor, scope.companyId, employeeId))) {
        skipped.push({ employeeId, reason: 'You do not manage this employee' });
        continue;
      }
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, companyId: scope.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) {
        skipped.push({ employeeId, reason: 'Employee not found' });
        continue;
      }
      const existing = await prisma.employeeGoalSet.findFirst({
        where: { companyId: scope.companyId, employeeId, cycleId },
        select: { id: true, status: true },
      });

      // A RETURNED set is the employee asking for a revision, so re-assigning
      // re-issues it in place: fresh snapshot from the (possibly cloned and
      // corrected) template, back to PENDING_ACCEPTANCE. Without this the
      // return → revise → accept loop dead-ends, since accept refuses a
      // RETURNED set and assign used to skip it.
      // DRAFT is likewise still un-issued, so it can be overwritten.
      if (existing && canReissueAssignment(existing.status)) {
        await prisma.$transaction(async (tx) => {
          await tx.employeeGoalKra.deleteMany({ where: { goalSetId: existing.id } });
          await tx.employeeGoalSet.update({
            where: { id: existing.id },
            data: {
              templateId: template.id,
              assignedByUserId: actor.userId,
              status: 'PENDING_ACCEPTANCE',
              submittedAt: now,
              // Clear the previous round's verdict so the history reads as a
              // fresh issue, but keep the employee's remark until they respond
              // again — the manager may still be acting on it.
              returnedAt: null,
              acceptedAt: null,
              kras: { create: lines },
            },
          });
        });
        assigned.push(existing.id);
        continue;
      }

      if (existing) {
        skipped.push({ employeeId, reason: `Already has a ${existing.status} goal set for this cycle` });
        continue;
      }

      const row = await prisma.employeeGoalSet.create({
        data: {
          companyId: scope.companyId,
          employeeId,
          cycleId,
          templateId: template.id,
          assignedByUserId: actor.userId,
          status: 'PENDING_ACCEPTANCE',
          submittedAt: now,
          kras: { create: lines },
        },
        select: { id: true },
      });
      assigned.push(row.id);
    }

    return NextResponse.json({ assigned, skipped, assignedCount: assigned.length, skippedCount: skipped.length }, { status: 201 });
  } catch (err) {
    console.error('[goal-assignment] POST failed', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to assign goals' }, { status: 500 });
  }
}
