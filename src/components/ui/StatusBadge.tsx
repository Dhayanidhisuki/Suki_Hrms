"use client";

import React from "react";

export function StatusBadge({ status }: { status: unknown }) {
  const rawStr = status == null || status === "" ? "—" : String(status).trim();
  const lower = rawStr.toLowerCase();

  let style = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";
  let dotColor = "bg-slate-400";

  if (["active", "available", "calibrated", "ok", "passed", "approved", "in stock", "success", "yes", "completed", "closed"].some(k => lower.includes(k))) {
    style = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50";
    dotColor = "bg-emerald-500";
  } else if (["issued", "out", "open", "in use", "in-use", "received", "partial"].some(k => lower.includes(k))) {
    style = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800/50";
    dotColor = "bg-blue-500";
  } else if (["pending", "due", "watch", "under calibration", "calibration", "warning"].some(k => lower.includes(k))) {
    style = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/50";
    dotColor = "bg-amber-500";
  } else if (["failed", "scrap", "scrapped", "overdue", "rejected", "out of service", "inactive", "blocked"].some(k => lower.includes(k))) {
    style = "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/50";
    dotColor = "bg-rose-500";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {rawStr}
    </span>
  );
}
