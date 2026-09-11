/**
 * POST   /api/employees/[id]/photo — multipart upload (`file` field), stores
 *        it under uploads/employees/<id>/ via file-storage.ts and saves the
 *        relative path on Employee.profilePhotoPath.
 * DELETE /api/employees/[id]/photo — clears profilePhotoPath. The stored
 *        file itself is left in place (matches the app's soft-delete
 *        philosophy elsewhere — nothing here hard-deletes from disk).
 *
 * Images only (jpg/jpeg/png/webp) — the shared saveUploadedFile() also
 * allows .pdf for document uploads elsewhere, so that's re-checked here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { saveUploadedFile } from '@/lib/file-storage';
import { logActivity } from '@/lib/activity-log';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true, profilePhotoPath: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (expected multipart field "file")' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large — maximum 5 MB' }, { status: 400 });
  }
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Only JPG, PNG or WEBP images are allowed' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = await saveUploadedFile(buffer, `employees/${employeeId}`, file.name);
    const profilePhotoPath = `/api/uploads/${relativePath}`;

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { profilePhotoPath } });
      await logActivity(tx, {
        employeeId,
        activityType: 'profile_photo_updated',
        module: 'basic',
        performedByUserId,
        oldValue: { profilePhotoPath: employee.profilePhotoPath },
        newValue: { profilePhotoPath },
      });
    });

    return NextResponse.json({ profilePhotoPath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const employeeId = parseInt(id);
  const performedByUserId = Number(request.headers.get('x-user-id')) || null;

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { profilePhotoPath: true } });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { profilePhotoPath: null } });
    await logActivity(tx, {
      employeeId,
      activityType: 'profile_photo_removed',
      module: 'basic',
      performedByUserId,
      oldValue: { profilePhotoPath: employee.profilePhotoPath },
      newValue: { profilePhotoPath: null },
    });
  });

  return NextResponse.json({ profilePhotoPath: null });
}
