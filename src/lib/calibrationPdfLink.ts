import jwt from "jsonwebtoken";
import { getAuthJwtSecret } from "@/lib/authTypes";

const PURPOSE = "calibration-record-pdf";

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
  const base = (
    process.env.QR_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  ).trim().replace(/\/$/, "");
  if (!base) return null;
  const params = new URLSearchParams({
    toolOrGaugeNo,
    token: signCalibrationPdfToken(toolOrGaugeNo),
  });
  return `${base}/api/tools/calibration-due/pdf?${params}`;
}
