/** POST /api/payroll/pms/[id]/upload — attach a supporting document to a
 * Performance Incentive row. Files are stored under /public/uploads/pms.
 * Manager access is team-scoped; HR/Admin can upload for any employee.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { getCompanyId } from '@/lib/companyScope';
import { getPmsAccess, canModifyEmployee, PMS_STATUSES } from '@/lib/pmsIncentive';
import { logActivity } from '@/lib/activity-log';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.xls', '.xlsx', '.csv', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getPmsAccess(request);
  if (access instanceof NextResponse) return access;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const record = await prisma.pmsIncentive.findUnique({
    where: { id: Number(id) },
    include: { employee: { select: { id: true, companyId: true, reportingManagerId: true } } },
  });
  if (!record || record.employee.companyId !== scope.companyId) {
    return NextResponse.json({ error: 'PMS incentive submission not found' }, { status: 404 });
  }

  const isManager = await canModifyEmployee(access.ownEmployeeId, record.employeeId, record.employee);
  const isAdmin = access.canApprove;
  if (!isManager && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to access this employee\'s incentive details.' }, { status: 403 });
  }
  if (isManager && !isAdmin && [PMS_STATUSES.APPROVED, PMS_STATUSES.REJECTED, PMS_STATUSES.FINALIZED].includes(record.status as never)) {
    return NextResponse.json({ error: 'This record is already finalized and cannot accept new files.' }, { status: 409 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Please upload the required supporting document before submitting.' }, { status: 400 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type ${ext || '(none)'} — use PDF, Excel, CSV, Word, JPG or PNG.` }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File is larger than the 5 MB limit.' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'pms');
  await mkdir(uploadsDir, { recursive: true });
  const safeName = `${record.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(uploadsDir, safeName);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.pmsIncentive.update({
      where: { id: record.id },
      data: { supportingFileName: file.name, supportingFilePath: `/uploads/pms/${safeName}` },
    });
    await logActivity(tx, {
      employeeId: record.employeeId,
      activityType: 'pms_file_uploaded',
      module: 'pms',
      performedByUserId: access.userId,
      oldValue: record.supportingFileName,
      newValue: file.name,
      relatedRecordId: record.id,
    });
    return saved;
  });

  return NextResponse.json(updated);
}
