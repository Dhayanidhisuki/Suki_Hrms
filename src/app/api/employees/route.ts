/**
 * GET  /api/employees          — list employees (paginated, filterable)
 * POST /api/employees          — create employee with Basic/Personal/Contact/Job Profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission, checkSpecificPermission } from '@/lib/rbac-employee';
import { employeeCreateSchema } from '@/lib/validations/employee';
import { summarizeExpiry } from '@/lib/document-expiry';
import { logActivity } from '@/lib/activity-log';
import { calculateProbationEndDate } from '@/lib/employee-form-fields';

export async function GET(request: NextRequest) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

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

  const where = {
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

/**
 * Employee Code is system-generated, not typed by the admin — EMP001,
 * EMP002, ... scoped per company (matches the @@unique([companyId,
 * employeeCode]) constraint, so each company has its own sequence).
 */
async function generateEmployeeCode(companyId: number): Promise<string> {
  const existing = await prisma.employee.findMany({
    where: { companyId, employeeCode: { startsWith: 'EMP' } },
    select: { employeeCode: true },
  });
  let max = 0;
  for (const e of existing) {
    const m = e.employeeCode.match(/^EMP(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `EMP${String(max + 1).padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'employee.create');
  if (permErr) return permErr;

  const body = await request.json();

  // Always server-generated — ignore whatever (if anything) the client sent.
  const companyIdNum = Number(body.companyId);
  if (Number.isInteger(companyIdNum) && companyIdNum > 0) {
    body.employeeCode = await generateEmployeeCode(companyIdNum);
  }

  const parsed = employeeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  // Employee code uniqueness is scoped per company.
  const existing = await prisma.employee.findFirst({
    where: { companyId: data.companyId, employeeCode: data.employeeCode },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Employee code already exists in this company' },
      { status: 409 }
    );
  }

  if (data.reportingManagerId) {
    const manager = await prisma.employee.findFirst({
      where: { id: data.reportingManagerId, deletedAt: null },
      select: { id: true },
    });
    if (!manager) {
      return NextResponse.json({ error: 'Reporting manager not found' }, { status: 400 });
    }
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          companyId: data.companyId,
          title: data.title,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          employeeCode: data.employeeCode,
          oldEmployeeCode: data.oldEmployeeCode,
          status: data.status,
          reportingManagerId: data.reportingManagerId,
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
                shiftPlanId: data.shiftPlanId,
                effectiveFrom: data.joinDate,
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

      return created;
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create employee' },
      { status: 400 }
    );
  }
}
