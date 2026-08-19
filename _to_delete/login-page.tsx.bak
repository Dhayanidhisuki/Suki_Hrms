"use client";

import { Suspense, useState, FormEvent } from "react";
import { Lock, User, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { LoginSchema } from "@/lib/validators";
import { LogoSpinner } from "@/components/LogoSpinner";
import { toastError } from "@/lib/appToast";

function safeRedirectTarget(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/auth/session-expired")) {
    return "/dashboard";
  }
  return raw;
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const searchParams = useSearchParams();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = LoginSchema.safeParse({ username, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        username: flat.username?.[0],
        password: flat.password?.[0],
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Invalid username or password";
        setError(msg);
        toastError(msg);
        setLoading(false);
        return;
      }

      // Full navigation so SessionProvider remounts and loads the JWT user
      // (client router.push alone left user=null → RoleGate Access Denied).
      const dest = safeRedirectTarget(searchParams.get("redirect"));
      window.location.assign(dest);
    } catch {
      const msg = "Failed to communicate with server. Please try again.";
      setError(msg);
      toastError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app,#0D1117)] text-[var(--text-primary,#f1f5f9)] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 20%, color-mix(in srgb, var(--primary, #2563eb) 18%, transparent), transparent), radial-gradient(ellipse 60% 40% at 80% 75%, color-mix(in srgb, var(--primary, #2563eb) 12%, transparent), transparent)",
        }}
      />

      <div className="w-full max-w-md bg-[var(--bg-card,#161B22)]/95 border border-[var(--border-main,#30363d)] backdrop-blur-xl rounded-3xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-blue.svg"
              alt="SUKI TOOLS"
              width={266}
              height={84}
              className="h-16 w-auto max-w-[min(100%,280px)] object-contain select-none"
              draggable={false}
            />
          </div>
          <p className="text-xs text-[var(--text-muted,#94a3b8)] font-medium">
            Sign in with your Tools Management account
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded-xl bg-[var(--color-danger-bg,rgba(244,63,94,0.1))] border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="login-username"
              className="text-xs font-semibold text-[var(--text-muted,#94a3b8)] uppercase tracking-wider ml-1"
            >
              Username
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-[var(--text-muted,#64748b)] group-focus-within:text-[var(--primary,#60a5fa)] transition-colors" />
              </div>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="block w-full pl-10 pr-3 py-3 bg-[var(--bg-subtle,#0f172a)]/60 border border-[var(--border-main,#334155)] rounded-xl text-sm placeholder:text-[var(--text-muted,#475569)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#3b82f6)]/40 focus:border-[var(--primary,#3b82f6)]/40 transition-all disabled:opacity-60"
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
              />
            </div>
            {fieldErrors.username && (
              <p className="text-[11px] text-rose-400 ml-1">{fieldErrors.username}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold text-[var(--text-muted,#94a3b8)] uppercase tracking-wider ml-1"
            >
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-[var(--text-muted,#64748b)] group-focus-within:text-[var(--primary,#60a5fa)] transition-colors" />
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="block w-full pl-10 pr-3 py-3 bg-[var(--bg-subtle,#0f172a)]/60 border border-[var(--border-main,#334155)] rounded-xl text-sm placeholder:text-[var(--text-muted,#475569)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#3b82f6)]/40 focus:border-[var(--primary,#3b82f6)]/40 transition-all disabled:opacity-60"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-400 ml-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-[var(--primary,#2563eb)] hover:opacity-90 text-white text-sm font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LogoSpinner size={18} />
                Signing in…
              </span>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-[var(--text-muted,#64748b)] font-medium uppercase tracking-widest">
          <ShieldCheck className="w-3.5 h-3.5" />
          Internal access — accounts are admin-provisioned
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-app,#0D1117)] flex items-center justify-center">
          <LogoSpinner size={56} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
