"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app,#0D1117)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--bg-card,#161B22)] border border-[var(--border-main,#30363d)] rounded-2xl p-8 text-center shadow-xl">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary,#fff)] tracking-tight">
          Session expired
        </h1>
        <p className="text-sm text-[var(--text-muted,#94a3b8)] mt-2">
          Your sign-in session is no longer valid. Please log in again to continue.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--primary,#2563eb)] text-white hover:opacity-90 transition-opacity"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
