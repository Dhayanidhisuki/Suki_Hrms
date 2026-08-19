import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export type DcVerificationType = "movement" | "calibration" | "receive";

function verificationSecret(): string {
  const secret =
    process.env.DC_QR_SIGNING_SECRET ??
    process.env.AUTH_JWT_SECRET ??
    process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "DC_QR_SIGNING_SECRET (or AUTH_JWT_SECRET/SESSION_SECRET) must be at least 32 characters"
    );
  }
  return secret;
}

function signaturePayload(type: DcVerificationType, id: string): string {
  return `${type}:${id.trim()}`;
}

export function signDcVerification(type: DcVerificationType, id: string): string {
  return createHmac("sha256", verificationSecret())
    .update(signaturePayload(type, id))
    .digest("base64url");
}

export function verifyDcSignature(
  type: DcVerificationType,
  id: string,
  signature: string | undefined
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signDcVerification(type, id));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function dcQrUrl(req: NextRequest, path: string): string {
  const configured = process.env.QR_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const base = configured || req.nextUrl.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function dcVerificationUrl(
  req: NextRequest,
  type: DcVerificationType,
  id: string | number
): string {
  const value = String(id).trim();
  const path = `/verify/dc/${type}/${encodeURIComponent(value)}`;
  const url = new URL(dcQrUrl(req, path));
  url.searchParams.set("sig", signDcVerification(type, value));
  return url.toString();
}
