/**
 * GET /api/uploads/<...path> — serves a file previously saved via
 * saveUploadedFile() (src/lib/file-storage.ts), e.g.
 * /api/uploads/employees/12/<uuid>.jpg. Files live outside `public/` so
 * this route is the only way to reach them — permission-gated by
 * checkEmployeePermission (see the /api/uploads rule in rbac-employee.ts:
 * requires employee.view).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkEmployeePermission } from '@/lib/rbac-employee';
import { readStoredFile } from '@/lib/file-storage';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const permErr = await checkEmployeePermission(request);
  if (permErr) return permErr;

  const { path: segments } = await params;
  const relativePath = segments.join('/');
  const ext = `.${relativePath.split('.').pop()?.toLowerCase() ?? ''}`;
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  try {
    const buffer = await readStoredFile(relativePath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Uploaded files are content-addressed by a random uuid filename —
        // once fetched under a given URL, that content never changes, so a
        // long-lived immutable cache is safe (a new upload gets a new URL).
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
