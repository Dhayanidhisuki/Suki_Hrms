"use client";

import Link from "next/link";
import { LogIn, ShieldAlert } from "lucide-react";

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Session Expired
        </h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Your session has ended due to inactivity. Please sign in again to
          continue using SUKI ERP Tools Management.
        </p>
        <Link
          href="/"
          id="session-expired-signin-btn"
          className="mt-6 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
        >
          <LogIn className="w-4 h-4" />
          Sign In Again
        </Link>
      </div>
    </div>
  );
}
