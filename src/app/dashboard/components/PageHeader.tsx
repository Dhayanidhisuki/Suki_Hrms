"use client";

import { Plus } from "lucide-react";

export default function PageHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      {/* ── Title block ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your tools and calibration easily
        </p>
      </div>

      {/* ── Primary CTA ── */}
      <button
        id="page-add-tool-btn"
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150 group"
      >
        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
        Add Tool
      </button>
    </div>
  );
}
