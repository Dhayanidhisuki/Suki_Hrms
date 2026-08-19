import jwt from "jsonwebtoken";
import { getAuthJwtSecret } from "@/lib/authTypes";

const PURPOSE = "calibration-record-pdf";
const DIGEST_PURPOSE = "calibration-digest-export";

export type DigestExportFormat = "pdf" | "xlsx";

function publicBaseUrl(): string {
  return (
    process.env.QR_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  ).trim().replace(/\/$/, "");
}

export function signCalibrationPdfToken(toolOrGaugeNo: string): string {
  return jwt.sign(
    { purpose: PURPOSE, toolOrGaugeNo },
    getAuthJwtSecret(),
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

export function verifyCalibrationPdfToken(token: string, toolOrGaugeNo: string): boolean {
  try {
    const decoded = jwt.verify(token, getAuthJwtSecret(), { algorithms: ["HS256"] });
    return typeof decoded === "object" && decoded !== null &&
      decoded.purpose === PURPOSE && decoded.toolOrGaugeNo === toolOrGaugeNo;
  } catch {
    return false;
  }
}

export function calibrationPdfEmailUrl(toolOrGaugeNo: string): string | null {
  const base = publicBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams({
    toolOrGaugeNo,
    token: signCalibrationPdfToken(toolOrGaugeNo),
  });
  return `${base}/api/tools/calibration-due/pdf?${params}`;
}

// ─── Digest (whole-list) export links ──────────────────────────────────────────

/**
 * Token for the "download the whole list" link in a digest email.
 *
 * The token carries only the recipient id and the digest channel — the server
 * re-derives the exact record set from the same role/unit rules used to build
 * the email, so the URL stays short no matter how many instruments are listed.
 */
export function signCalibrationDigestToken(userId: number, channel: string): string {
  return jwt.sign(
    { purpose: DIGEST_PURPOSE, userId, channel },
    getAuthJwtSecret(),
    { algorithm: "HS256", expiresIn: "30d" }
  );
}

export function verifyCalibrationDigestToken(
  token: string,
): { userId: number; channel: string } | null {
  try {
    const decoded = jwt.verify(token, getAuthJwtSecret(), { algorithms: ["HS256"] });
    if (
      typeof decoded !== "object" || decoded === null ||
      decoded.purpose !== DIGEST_PURPOSE ||
      typeof decoded.userId !== "number" ||
      typeof decoded.channel !== "string"
    ) {
      return null;
    }
    return { userId: decoded.userId, channel: decoded.channel };
  } catch {
    return null;
  }
}

export function calibrationDigestExportUrl(
  userId: number,
  channel: string,
  format: DigestExportFormat,
): string | null {
  const base = publicBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams({
    format,
    token: signCalibrationDigestToken(userId, channel),
  });
  return `${base}/api/tools/calibration-due/digest?${params}`;
}
