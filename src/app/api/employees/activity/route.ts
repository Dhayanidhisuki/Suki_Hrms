/**
 * GET /api/employees/activity   — read-only chronological activity timeline
 *                                  across all employees (the "Employee Activity"
 *                                  sidebar page). Filterable by employee/type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';

export async function GET(request: NextRequest) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const employeeId = searchParams.get('employeeId');
  const activityType = searchParams.get('activityType');
  const search = searchParams.get('search') ?? '';

  const where = {
    ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
    ...(activityType ? { activityType } : {}),
    ...(search
      ? {
          employee: {
            OR: [
              { employeeCode: { contains: search } },
              { oldEmployeeCode: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.employeeActivity.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { activityAt: 'desc' },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
    }),
    prisma.employeeActivity.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
