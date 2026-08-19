"use client";

import { Suspense, useState, FormEvent } from "react";
import { Lock, User, AlertCircle, ShieldCheck } from "lucide-react";
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

/** Decorative circuit traces + chip modules behind the card. Purely visual. */
function CircuitBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 2024 1162"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id="chipDots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#3a3f4a" />
          </pattern>
        </defs>

        <g stroke="#23262d" strokeWidth="1.5" fill="none">
          {/* upper-left trace */}
          <path d="M0 142 H206 M206 142 H560 L620 202 V520 L680 580 V760 L620 820 V1162" />
          {/* upper-right trace */}
          <path d="M2024 142 H1818 M1818 142 H1464 L1404 202 V520 L1344 580 V760 L1404 820 V1162" />
          {/* thin horizontals */}
          <path d="M0 128 H44 M0 156 H44 M1980 128 H2024 M1980 156 H2024" />
        </g>

        {/* chip modules */}
        <g>
          <rect x="46" y="108" width="134" height="68" rx="10" fill="#131519" stroke="#2a2e36" />
          <rect x="58" y="120" width="110" height="44" fill="url(#chipDots)" opacity="0.9" />
          <rect x="1844" y="108" width="134" height="68" rx="10" fill="#131519" stroke="#2a2e36" />
          <rect x="1856" y="120" width="110" height="44" fill="url(#chipDots)" opacity="0.9" />
        </g>

        {/* solder pads */}
        <g fill="#c9d1d9">
          <rect x="201" y="136" width="12" height="12" rx="2" />
          <rect x="1811" y="136" width="12" height="12" rx="2" />
        </g>
      </svg>

      {/* soft brand glow behind the card */}
      <div
        className="absolute left-1/2 top-1/2 h-[560px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(32,139,248,0.10), transparent)" }}
      />
    </div>
  );
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

  const inputClass =
    "block w-full rounded-xl border border-[#2a2e36] bg-[#141619] py-3.5 pl-11 pr-3.5 text-[15px] text-[#e6edf3] placeholder:text-[#6b7280] transition-colors focus:border-[#208bf8]/60 focus:outline-none focus:ring-2 focus:ring-[#208bf8]/25 disabled:opacity-60";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0b] p-4 text-[#e6edf3]">
      <CircuitBackdrop />

      <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-[#22252b] bg-[#131417] p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:p-10">
        {/* Brand lockup */}
        <div className="mb-7 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-blue.svg"
            alt="TOOLS by SUKI ERP"
            width={1960}
            height={635}
            className="block h-auto w-[244px] select-none"
            draggable={false}
          />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">
            Welcome Back
          </h1>
          <p className="mt-2.5 text-[14px] text-[#8b949e]">
            Sign in with your Tools Management account
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-username" className="sr-only">
              Username
            </label>
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <User className="h-[18px] w-[18px] text-[#6b7280] transition-colors group-focus-within:text-[#208bf8]" />
              </div>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className={inputClass}
                placeholder="Username"
                autoComplete="username"
                autoFocus
              />
            </div>
            {fieldErrors.username && (
              <p className="ml-1 mt-1.5 text-[11px] text-rose-400">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="sr-only">
              Password
            </label>
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock className="h-[18px] w-[18px] text-[#6b7280] transition-colors group-focus-within:text-[#208bf8]" />
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={inputClass}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
            {fieldErrors.password && (
              <p className="ml-1 mt-1.5 text-[11px] text-rose-400">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b82f6] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2f74e6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <LogoSpinner size={18} />
                Signing in…
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[10px] font-medium uppercase tracking-wider text-[#5b6371]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span>Internal access — admin-provisioned accounts</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
          <LogoSpinner size={56} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
