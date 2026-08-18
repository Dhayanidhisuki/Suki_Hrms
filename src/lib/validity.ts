export type ValidityStatus = "ok" | "dueSoon" | "overdue" | "none";

export interface ValidityResult {
  days: number | null;   // null when Next Calibration Due is missing
  status: ValidityStatus;
}

/**
 * Live-computed Validity (Days) utility.
 *
 * Computes live days remaining until next calibration due date relative to today.
 * NEVER written to any DB table or column.
 */
export function getValidity(
  nextCalibrationDue: Date | string | null | undefined,
  dueSoonThresholdDays = 30
): ValidityResult {
  if (!nextCalibrationDue) return { days: null, status: "none" };

  const due = new Date(nextCalibrationDue);
  if (isNaN(due.getTime())) return { days: null, status: "none" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  let status: ValidityStatus;
  if (days < 0) status = "overdue";
  else if (days <= dueSoonThresholdDays) status = "dueSoon";
  else status = "ok";

  return { days, status };
}
