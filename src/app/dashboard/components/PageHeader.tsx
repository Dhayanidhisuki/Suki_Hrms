"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PageHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      {/* ── Title block ── */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Manage your tools and calibration easily
        </p>
      </div>

      {/* ── Primary CTA ── */}
      <Button id="page-add-tool-btn" variant="primary" className="group">
        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
        Add Tool
      </Button>
    </div>
  );
}
