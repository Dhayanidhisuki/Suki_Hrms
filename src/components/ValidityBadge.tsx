import React from "react";
import { getValidity } from "@/lib/validity";

interface ValidityBadgeProps {
  nextCalibrationDue: Date | string | null | undefined;
  dueSoonThresholdDays?: number;
  className?: string;
}

export function ValidityBadge({
  nextCalibrationDue,
  dueSoonThresholdDays = 30,
  className = "",
}: ValidityBadgeProps) {
  const { days, status } = getValidity(nextCalibrationDue, dueSoonThresholdDays);

  if (status === "none" || days === null) {
    return <span className={`text-xs text-[var(--text-muted)] ${className}`}>—</span>;
  }

  let colorClasses = "";
  let badgeText = "";

  switch (status) {
    case "ok":
      colorClasses =
        "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 shadow-xs";
      badgeText = `${days} days`;
      break;
    case "dueSoon":
      colorClasses =
        "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 shadow-xs";
      badgeText = `${days} days`;
      break;
    case "overdue":
      colorClasses =
        "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 shadow-xs";
      badgeText = `${Math.abs(days)} overdue`;
      break;
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold whitespace-nowrap ${colorClasses} ${className}`}
    >
      {badgeText}
    </span>
  );
}
