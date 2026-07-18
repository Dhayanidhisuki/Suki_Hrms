/**
 * GET  /api/employees          — list employees (paginated)
 * POST /api/employees          — create employee with nested relations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { employeeCreateSchema } from '@/lib/validations/employee';
import { summarizeExpiry } from '@/lib/document-expiry';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status');

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { employeeCode: { contains: search } },
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
        personalDetails: true,
        jobInfos: {
          where: { effectiveTo: null },
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            employeeType: { select: { id: true, name: true } },
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = employeeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check employeeCode uniqueness
  const existing = await prisma.employee.findUnique({
    where: { employeeCode: data.employeeCode },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Employee code already exists' },
      { status: 409 }
    );
  }

  // Create employee with nested relations
  const employee = await prisma.employee.create({
    data: {
      employeeCode: data.employeeCode,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      status: data.status,
      reportingManagerId: data.reportingManagerId,
      personalDetails: data.personalDetails ? { create: data.personalDetails } : undefined,
      jobInfos: data.jobInfo ? { create: [data.jobInfo] } : undefined,
      salaryStructures: data.salaryStructure ? { create: [data.salaryStructure] } : undefined,
      bankDetail: data.bankDetail ? { create: data.bankDetail } : undefined,
      dependents: data.dependents ? { create: data.dependents } : undefined,
      experiences: data.experiences ? { create: data.experiences } : undefined,
      educations: data.educations ? { create: data.educations } : undefined,
    },
    include: {
      personalDetails: true,
      jobInfos: { include: { department: true, designation: true, employeeType: true } },
      salaryStructures: true,
      bankDetail: true,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
