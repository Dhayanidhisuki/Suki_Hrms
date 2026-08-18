import type { NextRequest } from "next/server";

export function dcQrUrl(req: NextRequest, path: string): string {
  const configured = process.env.QR_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const base = configured || req.nextUrl.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
