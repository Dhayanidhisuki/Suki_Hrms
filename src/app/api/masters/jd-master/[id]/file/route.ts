/**
 * GET  /api/jd-master/:id/file — download the uploaded JD document
 * POST /api/jd-master/:id/file — replace the uploaded JD document
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { readStoredFile, saveUploadedFile } from '@/lib/file-storage';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const record = await prisma.jobDescription.findFirst({
    where: { id, deletedAt: null },
    select: { jdFileUrl: true, jdCode: true },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!record.jdFileUrl) return NextResponse.json({ error: 'No file uploaded' }, { status: 404 });

  const relative = record.jdFileUrl.replace(/^\/api\/uploads\//, '');
  const ext = path.extname(relative).toLowerCase();
  const preview = request.nextUrl.searchParams.get('preview') === '1';
  try {
    const buffer = await readStoredFile(relative);
    if (preview && (ext === '.docx' || ext === '.doc')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ buffer });
        const body = result.value?.trim()
          ? result.value
          : '<p>This Word file has no readable text to show.</p>';
        return new NextResponse(wrapPreviewHtml(record.jdCode, body), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, max-age=60',
            'X-Frame-Options': 'SAMEORIGIN',
          },
        });
      } catch {
        return new NextResponse(
          wrapPreviewHtml(
            record.jdCode,
            '<p>This Word file cannot be shown here. Use Download to open it on your computer.</p>'
          ),
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': 'inline',
              'X-Frame-Options': 'SAMEORIGIN',
            },
          }
        );
      }
    }
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${record.jdCode}${ext}"`,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

function wrapPreviewHtml(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 760px; margin: 24px auto; padding: 0 20px 40px; color: #111827; line-height: 1.55; }
    h1, h2, h3 { font-family: system-ui, sans-serif; }
    p { margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    td, th { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const current = await prisma.jobDescription.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file uploaded (expected multipart field "file")' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const jdFileUrl = await saveUploadedFile(buffer, `jd-master/${id}`, file.name);
    await prisma.jobDescription.update({ where: { id }, data: { jdFileUrl } });
    return NextResponse.json({ jdFileUrl: `/api/masters/jd-master/${id}/file` });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
  }
}
