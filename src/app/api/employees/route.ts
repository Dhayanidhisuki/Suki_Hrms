/**
 * GET  /api/employees          — list employees (paginated, filterable)
 * POST /api/employees          — create employee with Basic/Personal/Contact/Job Profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission, checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import { employeeCreateSchema } from '@/lib/validations/employee';
import { summarizeExpiry } from '@/lib/document-expiry';
import { logActivity } from '@/lib/activity-log';
import { calculateProbationEndDate } from '@/lib/employee-form-fields';
import { randomUUID } from 'crypto';
import { allocateEmployeeCode } from '@/lib/employee/codePolicy';
import { creationChain, initialiseLifecycle } from '@/lib/employee/lifecycle';
import { recordReportingChange, resolveNoticePeriod } from '@/lib/employee/resolveJob';
import { scopeContextFromHeaders, visibleEmployeeWhere } from '@/lib/employee/scope';
import { audit } from '@/lib/platform/audit/service';
import { emitPlatformEvent } from '@/lib/platform/events';

export async function GET(request: NextRequest) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;
  // Scoped here since new callers (Time Office pickers) depend on it not
  // leaking other companies' employees — the rest of this module's routes
  // still trust client-supplied companyId (pre-existing gap, flagged
  // separately, out of scope to fix in full right now).
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status');
  const departmentId = searchParams.get('departmentId');
  const designationId = searchParams.get('designationId');
  const employeeTypeId = searchParams.get('employeeTypeId');

  const jobInfoFilter =
    departmentId || designationId || employeeTypeId
      ? {
          some: {
            effectiveTo: null,
            ...(departmentId ? { departmentId: parseInt(departmentId) } : {}),
            ...(designationId ? { designationId: parseInt(designationId) } : {}),
            ...(employeeTypeId ? { employeeTypeId: parseInt(employeeTypeId) } : {}),
          },
        }
      : undefined;

  // BRD 01 §20: the caller sees the union of their data scopes (+ SELF);
  // superadmin bypasses. Applied in the query, never after the read.
  const ctx = scopeContextFromHeaders(request.headers);
  const scopeWhere = await visibleEmployeeWhere(ctx.userId, scope.companyId, { isSuperAdmin: ctx.isSuperAdmin });

  const where = {
    AND: [scopeWhere],
    companyId: scope.companyId,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(jobInfoFilter ? { jobInfos: jobInfoFilter } : {}),
    ...(search
      ? {
          OR: [
            { employeeCode: { contains: search } },
            { oldEmployeeCode: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        }
      : {}),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        personalDetails: true,
        jobInfos: {
          where: { effectiveTo: null },
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            employeeType: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
          },
          take: 1,
        },
        reportingManager: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        secondReportingManager: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        documents: {
          select: { id: true, expiryDate: true },
        },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({
    data: employees.map((emp) => ({
      ...emp,
      documentExpirySummary: summarizeExpiry(emp.documents),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.create');
  if (permErr) return permErr;

  const body = await request.json();

  // Always server-generated from the company's code policy (BRD 01 §7.2),
  // allocated inside the create transaction — ignore whatever the client sent.
  body.employeeCode = '__AUTO__';

  const parsed = employeeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;
  const actor = { userId: performedByUserId };

  if (data.reportingManagerId) {
    const manager = await prisma.employee.findFirst({
      where: { id: data.reportingManagerId, deletedAt: null },
      select: { id: true },
    });
    if (!manager) {
      return NextResponse.json({ error: 'Reporting manager not found' }, { status: 400 });
    }
  }

  if (data.secondReportingManagerId) {
    const secondManager = await prisma.employee.findFirst({
      where: { id: data.secondReportingManagerId, deletedAt: null },
      select: { id: true },
    });
    if (!secondManager) {
      return NextResponse.json({ error: 'Second reporting manager not found' }, { status: 400 });
    }
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const employeeCode = await allocateEmployeeCode(data.companyId, tx);
      // §19: offer value not carried by the manual form → grade default, else policy.
      const notice = await resolveNoticePeriod(data.companyId, data.gradeId ?? null, null, tx);
      const created = await tx.employee.create({
        data: {
          companyId: data.companyId,
          title: data.title,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          employeeCode,
          oldEmployeeCode: data.oldEmployeeCode,
          officeEmail: data.officeEmail,
          status: data.status,
          personUid: randomUUID(),
          reportingManagerId: data.reportingManagerId,
          secondReportingManagerId: data.secondReportingManagerId,
          profilePhotoPath: data.profilePhotoPath,
          signaturePath: data.signaturePath,
          jobInfos: {
            create: [
              {
                departmentId: data.departmentId,
                subDepartmentId: data.subDepartmentId,
                designationId: data.designationId,
                employeeTypeId: data.employeeTypeId,
                categoryId: data.categoryId,
                subCategory: data.subCategory,
                gradeId: data.gradeId,
                levelId: data.levelId,
                unitId: data.unitId,
                productionLine: data.productionLine,
                additionalRole: data.additionalRole,
                teamGroup: data.teamGroup,
                joinDate: data.joinDate,
                probationPeriodMonths: data.probationPeriodMonths,
                probationEndDate: calculateProbationEndDate(data.joinDate, data.probationPeriodMonths),
                shiftMasterId: data.shiftMasterId,
                shiftAssignmentType: data.shiftAssignmentType,
                shiftRotationPlanId: data.shiftAssignmentType === 'ROTATIONAL' ? data.shiftRotationPlanId : null,
                effectiveFrom: data.joinDate,
                noticePeriodDays: notice.days,
                noticePeriodSource: notice.source,
                changeReason: 'JOINING',
                ...(data.jobProfile ?? {}),
              },
            ],
          },
          personalDetails: data.personalDetails ? { create: data.personalDetails } : undefined,
          contactDetails: data.contactDetails ? { create: data.contactDetails } : undefined,
          bankDetail: data.bankDetail ? { create: data.bankDetail } : undefined,
          dependents: data.dependents ? { create: data.dependents } : undefined,
          experiences: data.experiences ? { create: data.experiences } : undefined,
          educations: data.educations ? { create: data.educations } : undefined,
          employeeBenefits: data.benefitRateIds?.length
            ? { create: data.benefitRateIds.map((benefitRateId) => ({ benefitRateId })) }
            : undefined,
        },
        include: {
          company: true,
          personalDetails: true,
          contactDetails: true,
          jobInfos: { include: { department: true, designation: true, employeeType: true } },
          bankDetail: true,
        },
      });

      await logActivity(tx, {
        employeeId: created.id,
        activityType: 'created',
        module: 'basic',
        performedByUserId,
        newValue: { employeeCode: created.employeeCode, firstName: created.firstName, lastName: created.lastName },
      });

      // §8.2 rules 1–5 in the creating transaction; §17 dated reporting line.
      const lifecycleState = await initialiseLifecycle(
        data.companyId,
        created.id,
        creationChain({ probationMonths: data.probationPeriodMonths }),
        { trigger: 'MANUAL_CREATE', effectiveDate: data.joinDate, actor },
        tx
      );
      await recordReportingChange(
        {
          companyId: data.companyId,
          employeeId: created.id,
          primaryManagerId: data.reportingManagerId ?? null,
          secondaryManagerId: data.secondReportingManagerId ?? null,
          effectiveFrom: data.joinDate,
          changeReason: 'JOINING',
          actor,
        },
        tx
      );
      await audit(
        {
          companyId: data.companyId,
          entityType: 'Employee',
          entityId: created.id,
          entityRef: created.employeeCode,
          action: 'CREATE',
          actor,
          after: { employeeCode: created.employeeCode, firstName: created.firstName, lastName: created.lastName, lifecycleState },
        },
        tx
      );

      return { ...created, lifecycleState };
    });

    await emitPlatformEvent(data.companyId, 'EMPLOYEE_CREATED', {
      moduleCode: 'CORE',
      sourceEntityType: 'Employee',
      sourceEntityId: employee.id,
      subjectEmpId: employee.id,
      linkPath: `/employees/${employee.id}`,
      data: { Employee: { code: employee.employeeCode, source: 'MANUAL' } },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create employee' },
      { status: 400 }
    );
  }
}
