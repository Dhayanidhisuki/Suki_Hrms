/**
 * Local filesystem storage for employee uploads (profile photo, signature,
 * and — in later phases — education/passport/KYC documents).
 *
 * Files live under a project-root `uploads/` directory (outside `public/`,
 * so they are never served directly by Next's static file handler — access
 * goes through the permission-gated /api/uploads/[...path] route instead).
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.webp']);

function sanitizeSubdir(subdir: string): string {
  const cleaned = subdir.replace(/[^a-zA-Z0-9/_-]/g, '');
  if (cleaned.includes('..')) throw new Error('Invalid subdirectory path.');
  return cleaned;
}

/**
 * Save an uploaded file under uploads/<subdir>/. Returns the relative path
 * to store in the DB (e.g. "employees/12/photo-<uuid>.jpg").
 */
export async function saveUploadedFile(
  buffer: Buffer,
  subdir: string,
  originalFilename: string
): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ${ext || '(none)'} is not allowed.`);
  }

  const safeSubdir = sanitizeSubdir(subdir);
  const dir = path.join(UPLOADS_ROOT, safeSubdir);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buffer);

  return path.join(safeSubdir, filename).replace(/\\/g, '/');
}

/** Read a previously stored file by its relative path. */
export async function readStoredFile(relativePath: string): Promise<Buffer> {
  const safe = sanitizeSubdir(relativePath);
  const fullPath = path.join(UPLOADS_ROOT, safe);
  if (!existsSync(fullPath)) {
    throw new Error('File not found.');
  }
  return readFile(fullPath);
}
