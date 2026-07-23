import { prisma } from "./prisma";

// Generate next sequential number for any prefixed document number
// Example: generateDocNumber("DC", "GAUGE_TOOLS_ISSUE", "DC_NO") → "DC-2026-001"
export async function generateDocNumber(
  prefix: string,
  tableName: string,
  columnName: string
): Promise<string> {
  const year = new Date().getFullYear();
  const likePattern = `${prefix}-${year}-%`;

  const result = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM ${tableName} WHERE ${columnName} LIKE '${likePattern}'`
  );

  const count = Number(result[0]?.cnt ?? 0);
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${year}-${seq}`;
}

// Calculate next calibration date
export function calcNextCalibDate(
  calibrationDate: Date,
  frequencyMonths: number
): Date {
  const next = new Date(calibrationDate);
  next.setMonth(next.getMonth() + frequencyMonths);
  return next;
}

// Check if calibration is overdue
export function isCalibrationOverdue(nextCalibDate: Date | null): boolean {
  if (!nextCalibDate) return false;
  return nextCalibDate < new Date();
}

// Days until calibration (negative = overdue)
export function daysUntilCalibration(
  nextCalibDate: Date | null
): number | null {
  if (!nextCalibDate) return null;
  const diff = nextCalibDate.getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
