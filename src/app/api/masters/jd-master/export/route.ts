/**
 * GET /api/jd-master/export — Excel of the currently filtered/searched list
 * (not the whole table). Same query params as GET /api/jd-master, no pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { buildListWhere, jdInclude, parseTagFilters } from '@/lib/jd-master';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || undefined;
  const departmentId = searchParams.get('departmentId') ? Number(searchParams.get('departmentId')) : undefined;
  const designationId = searchParams.get('designationId') ? Number(searchParams.get('designationId')) : undefined;
  const status = searchParams.get('status')?.trim() || undefined;
  const tags = parseTagFilters(searchParams);

  const where = buildListWhere({
    search,
    departmentId: departmentId && !Number.isNaN(departmentId) ? departmentId : undefined,
    designationId: designationId && !Number.isNaN(designationId) ? designationId : undefined,
    status,
    tags,
  });

  const rows = await prisma.jobDescription.findMany({
    where,
    orderBy: { jdCode: 'asc' },
    take: 5000,
    include: jdInclude,
  });

  const header = [
    'JD Code',
    'Department',
    'Designation',
    'Title',
    'Min Exp (yrs)',
    'Max Exp (yrs)',
    'Salary Package',
    'JD File',
    'Created Date',
  ];
  const aoa = [
    header,
    ...rows.map((r) => [
      r.jdCode,
      r.department.name,
      r.designation.name,
      r.title,
      r.minExperienceYears == null ? '' : Number(r.minExperienceYears),
      r.maxExperienceYears == null ? '' : Number(r.maxExperienceYears),
      r.salaryPackage ?? '',
      r.jdFileUrl ? 'Yes' : 'No',
      r.createdAt.toISOString().slice(0, 10),
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 36 }, { wch: 12 }, { wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'JD Master');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="jd-master.xlsx"',
    },
  });
}
