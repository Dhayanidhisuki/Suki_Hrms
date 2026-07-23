"use client";

import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

interface ActionButtonProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  variant: "primary" | "secondary" | "ghost";
  onClick?: () => void;
}

function ActionButton({
  id,
  icon,
  label,
  sublabel,
  variant,
  onClick,
}: ActionButtonProps) {
  const styles = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 shadow-sm hover:shadow-md",
    secondary:
      "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md",
    ghost:
      "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-dashed border-slate-300 hover:border-slate-400",
  };

  return (
    <button
      id={id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-150 group ${styles[variant]}`}
    >
      {/* Icon container */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          variant === "primary"
            ? "bg-white/20 group-hover:bg-white/30"
            : variant === "secondary"
            ? "bg-blue-50 group-hover:bg-blue-100"
            : "bg-white group-hover:bg-blue-50"
        }`}
      >
        <span
          className={
            variant === "primary"
              ? "text-white"
              : variant === "secondary"
              ? "text-blue-600"
              : "text-slate-500 group-hover:text-blue-600"
          }
        >
          {icon}
        </span>
      </div>

      {/* Text */}
      <div className="text-left min-w-0">
        <p
          className={`text-sm font-semibold leading-tight ${
            variant === "primary" ? "text-white" : "text-slate-800"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-[11px] leading-tight mt-0.5 ${
            variant === "primary" ? "text-blue-100" : "text-slate-400"
          }`}
        >
          {sublabel}
        </p>
      </div>

      {/* Arrow */}
      <ArrowUpRight
        className={`w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 ${
          variant === "primary" ? "text-blue-200" : "text-slate-400"
        }`}
      />
    </button>
  );
}

export default function QuickActions() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      {/* ── Header ── */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">
          Quick Actions
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Common tool management tasks
        </p>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-col gap-3">
        <Link href="/dashboard/transactions/issue" className="block w-full">
          <ActionButton id="qa-issue-tool-btn" icon={<ArrowUpRight className="w-4.5 h-4.5" />} label="Issue Tool" sublabel="Record a tool issue to employee" variant="primary" />
        </Link>
        <Link href="/dashboard/transactions/receive" className="block w-full">
          <ActionButton id="qa-receive-tool-btn" icon={<ArrowDownLeft className="w-4.5 h-4.5" />} label="Receive Tool" sublabel="Record tool return from employee" variant="secondary" />
        </Link>
        <Link href="/dashboard/calibration/due-list" className="block w-full">
          <ActionButton id="qa-calibration-list-btn" icon={<ClipboardList className="w-4.5 h-4.5" />} label="Calibration Due List" sublabel="View upcoming calibrations" variant="secondary" />
        </Link>
        <Link href="/dashboard/masters/tools" className="block w-full">
          <ActionButton id="qa-add-tool-btn" icon={<Plus className="w-4.5 h-4.5" />} label="Add New Tool" sublabel="Register a new tool in GAUGEANDTOOLS" variant="ghost" />
        </Link>
      </div>

      {/* ── Footer note ── */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          All actions are logged in the Tools History Card
        </p>
      </div>
    </div>
  );
}
