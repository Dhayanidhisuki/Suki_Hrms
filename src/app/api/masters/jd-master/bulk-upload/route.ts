/**
 * POST /api/masters/jd-master/bulk-upload — CSV/Excel or a ZIP of CSV + JD files.
 * Optional column "JD File" names the PDF/DOC to attach (from the ZIP, extra
 * form files, or public/templates/jd-samples).
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { saveUploadedFile } from '@/lib/file-storage';
import { bulkJdRowSchema } from '@/lib/validations/jd-master';
import { allocateJdCode, normalizeTags, replaceTags } from '@/lib/jd-master';

const JD_FILE_EXTS = new Set(['.pdf', '.doc', '.docx']);
const SHEET_EXTS = new Set(['.csv', '.xlsx', '.xls']);
const SAMPLE_JD_DIR = path.join(process.cwd(), 'public/templates/jd-samples');
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type IncomingRow = {
  department: string;
  designation: string;
  title: string;
  description: string;
  tags?: string | null;
  minExperienceYears?: string | number | null;
  maxExperienceYears?: string | number | null;
  salaryPackage?: string | null;
  fileName?: string | null;
};

function cell(value: unknown): string {
  return String(value ?? '').trim();
}

function parseSheet(buffer: Buffer): IncomingRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (aoa.length < 2) return [];
  const header = (aoa[0] ?? []).map((h) => cell(h).toLowerCase());
  const idx = {
    department: header.findIndex((h) => h === 'department' || h === 'department code' || h === 'dept'),
    designation: header.findIndex((h) => h === 'designation' || h === 'designation code'),
    title: header.findIndex((h) => h === 'title'),
    description: header.findIndex((h) => h === 'description' || h === 'job description'),
    tags: header.findIndex((h) => h === 'tags' || h === 'skills'),
    minExperience: header.findIndex((h) => h.includes('min') && h.includes('exp')),
    maxExperience: header.findIndex((h) => h.includes('max') && h.includes('exp')),
    salary: header.findIndex((h) => h.includes('salary')),
    fileName: header.findIndex(
      (h) => h === 'jd file' || h === 'file' || h === 'filename' || h === 'jd file name' || h === 'file name'
    ),
  };
  const rows: IncomingRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const line = aoa[i] ?? [];
    rows.push({
      department: cell(idx.department >= 0 ? line[idx.department] : line[0]),
      designation: cell(idx.designation >= 0 ? line[idx.designation] : line[1]),
      title: cell(idx.title >= 0 ? line[idx.title] : line[2]),
      description: cell(idx.description >= 0 ? line[idx.description] : line[3]),
      tags: cell(idx.tags >= 0 ? line[idx.tags] : ''),
      minExperienceYears: cell(idx.minExperience >= 0 ? line[idx.minExperience] : ''),
      maxExperienceYears: cell(idx.maxExperience >= 0 ? line[idx.maxExperience] : ''),
      salaryPackage: cell(idx.salary >= 0 ? line[idx.salary] : ''),
      fileName: cell(idx.fileName >= 0 ? line[idx.fileName] : ''),
    });
  }
  return rows;
}

function key(value: string) {
  return value.trim().toLowerCase();
}

function safeFileName(name: string): string | null {
  const base = path.basename(name.replace(/\\/g, '/')).trim();
  if (!base || base.includes('..')) return null;
  const ext = path.extname(base).toLowerCase();
  if (!JD_FILE_EXTS.has(ext)) return null;
  return base;
}

async function extractZip(buffer: Buffer): Promise<{ sheet: Buffer | null; files: Map<string, Buffer> }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  let sheet: Buffer | null = null;
  const files = new Map<string, Buffer>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const base = path.basename(entry.name);
    const ext = path.extname(base).toLowerCase();
    const buf = Buffer.from(await entry.async('nodebuffer'));
    if (!sheet && SHEET_EXTS.has(ext)) sheet = buf;
    if (JD_FILE_EXTS.has(ext) && buf.length > 0 && buf.length <= MAX_FILE_BYTES) {
      files.set(base.toLowerCase(), buf);
    }
  }
  return { sheet, files };
}

async function resolveJdFile(
  fileName: string | null | undefined,
  pack: Map<string, Buffer>
): Promise<{ name: string; buffer: Buffer } | null> {
  const base = fileName ? safeFileName(fileName) : null;
  if (!base) return null;
  const packed = pack.get(base.toLowerCase());
  if (packed) return { name: base, buffer: packed };
  const samplePath = path.join(SAMPLE_JD_DIR, base);
  if (existsSync(samplePath)) {
    const buffer = await readFile(samplePath);
    if (buffer.length > 0 && buffer.length <= MAX_FILE_BYTES) return { name: base, buffer };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const createdByUserId = Number(request.headers.get('x-user-id')) || null;

  const ct = request.headers.get('content-type') ?? '';
  let incoming: IncomingRow[] = [];
  const pack = new Map<string, Buffer>();

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No file uploaded (expected multipart field "file")' }, { status: 400 });
    }
    const uploadedName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (uploadedName.endsWith('.zip')) {
      const extracted = await extractZip(buffer);
      if (!extracted.sheet) {
        return NextResponse.json({ error: 'ZIP must contain a CSV or Excel file' }, { status: 400 });
      }
      incoming = parseSheet(extracted.sheet);
      for (const [name, buf] of extracted.files) pack.set(name, buf);
    } else {
      incoming = parseSheet(buffer);
    }
  } else {
    const json = await request.json().catch(() => null);
    const rows = (json as { rows?: IncomingRow[] } | null)?.rows;
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Expected { rows: [...] } or a multipart file' }, { status: 400 });
    }
    incoming = rows;
  }

  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No data rows found' }, { status: 400 });
  }
  if (incoming.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 rows per upload' }, { status: 400 });
  }

  const [departments, designations] = await Promise.all([
    prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true } }),
    prisma.designation.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true } }),
  ]);
  const deptBy = new Map<string, number>();
  for (const d of departments) {
    deptBy.set(key(d.code), d.id);
    deptBy.set(key(d.name), d.id);
  }
  const desigBy = new Map<string, number>();
  for (const d of designations) {
    desigBy.set(key(d.code), d.id);
    desigBy.set(key(d.name), d.id);
  }

  const failedRows: { row: number; reason: string }[] = [];
  let successCount = 0;
  let attachedFileCount = 0;

  for (let i = 0; i < incoming.length; i++) {
    const excelRow = i + 2;
    const parsed = bulkJdRowSchema.safeParse(incoming[i]);
    if (!parsed.success) {
      failedRows.push({ row: excelRow, reason: 'Missing required Department, Designation, Title or Description' });
      continue;
    }
    const departmentId = deptBy.get(key(parsed.data.department));
    const designationId = desigBy.get(key(parsed.data.designation));
    if (!departmentId) {
      failedRows.push({ row: excelRow, reason: `Unknown department "${parsed.data.department}"` });
      continue;
    }
    if (!designationId) {
      failedRows.push({ row: excelRow, reason: `Unknown designation "${parsed.data.designation}"` });
      continue;
    }

    try {
      const jdFile = await resolveJdFile(parsed.data.fileName, pack);
      const createdId = await prisma.$transaction(async (tx) => {
        const jdCode = await allocateJdCode(tx);
        const record = await tx.jobDescription.create({
          data: {
            jdCode,
            departmentId,
            designationId,
            title: parsed.data.title,
            description: parsed.data.description,
            minExperienceYears: parsed.data.minExperienceYears ?? null,
            maxExperienceYears: parsed.data.maxExperienceYears ?? null,
            salaryPackage: parsed.data.salaryPackage || null,
            status: 'Active',
            createdByUserId,
          },
        });
        await replaceTags(tx, record.id, normalizeTags(parsed.data.tags));
        return record.id;
      });
      if (jdFile) {
        const jdFileUrl = await saveUploadedFile(jdFile.buffer, `jd-master/${createdId}`, jdFile.name);
        await prisma.jobDescription.update({ where: { id: createdId }, data: { jdFileUrl } });
        attachedFileCount += 1;
      }
      successCount += 1;
    } catch (err) {
      failedRows.push({
        row: excelRow,
        reason: err instanceof Error ? err.message : 'Failed to create JD',
      });
    }
  }

  return NextResponse.json({ successCount, failedRows, attachedFileCount });
}
