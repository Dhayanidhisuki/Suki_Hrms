import path from "path";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, access } from "fs/promises";
export { TOOL_DOC_TYPES, isToolDocType, type ToolDocType } from "@/lib/toolDocumentTypes";

/** Extension → preferred MIME (used when browser sends empty/octet-stream). */
export const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".msg": "application/vnd.ms-outlook",
  ".eml": "message/rfc822",
};

export const ALLOWED_EXTS = Object.keys(EXT_MIME);

/** Legacy MIME map kept for callers that still check by MIME. */
export const ALLOWED_MIME: Record<string, string[]> = Object.entries(EXT_MIME).reduce(
  (acc, [ext, mime]) => {
    (acc[mime] ??= []).push(ext);
    return acc;
  },
  {} as Record<string, string[]>
);

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB


/** Sanitize tool folder segment */
export function safeToolFolder(toolOrGaugeNo: string): string {
  return toolOrGaugeNo.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 50) || "unknown";
}

/** Synthetic tool key for DC-level attachments (no single tool). */
export function dcDocumentKey(dcNo: string | number): string {
  return `CALIB-DC-${String(dcNo).replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 20)}`;
}

export function extensionFor(originalName: string, mimeType: string): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (fromName && ALLOWED_EXTS.includes(fromName)) return fromName;
  const byMime = ALLOWED_MIME[mimeType];
  if (byMime?.[0]) return byMime[0];
  return ".bin";
}

export function assertAllowedFile(originalName: string, mimeType: string, size: number) {
  if (size <= 0) throw new Error("Empty file");
  if (size > MAX_DOC_BYTES) throw new Error("File exceeds 10 MB limit");
  const ext = path.extname(originalName).toLowerCase();
  if (!ext || !ALLOWED_EXTS.includes(ext)) {
    throw new Error(
      `File type not allowed (use ${ALLOWED_EXTS.join(", ")})`
    );
  }
  // Prefer extension trust; MIME may be empty/octet-stream from browsers
  void mimeType;
}

export function resolveStoredMime(originalName: string, mimeType: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return EXT_MIME[ext] ?? (mimeType || "application/octet-stream");
}

export async function persistToolDocumentFile(opts: {
  toolOrGaugeNo: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storedName: string; absolutePath: string; relativeDir: string }> {
  const folder = safeToolFolder(opts.toolOrGaugeNo);
  const relativeDir = folder;
  const dir = path.join(process.env.TOOL_DOCS_ROOT!, relativeDir);
  await mkdir(dir, { recursive: true });

  const ext = extensionFor(opts.originalName, opts.mimeType);
  const storedName = `${randomUUID()}${ext}`;
  const absolutePath = path.join(dir, storedName);
  await writeFile(absolutePath, opts.buffer);
  return { storedName, absolutePath, relativeDir };
}

export function absoluteDocPath(toolOrGaugeNo: string, storedName: string): string {
  return path.join(process.env.TOOL_DOCS_ROOT!, safeToolFolder(toolOrGaugeNo), storedName);
}

export async function removeDocFile(toolOrGaugeNo: string, storedName: string) {
  const abs = absoluteDocPath(toolOrGaugeNo, storedName);
  try {
    await access(abs);
    await unlink(abs);
  } catch {
    // ignore missing file
  }
}
