/**
 * Login page — /login
 * Email + password form. On success, redirects to home.
 *
 * Layout matches the split reference: white sign-in column on the left,
 * blue brand panel on the right with a tilted tablet. The tablet screen is
 * a miniature of this HRMS app (sidebar, top bar, KPI cards, employee list).
 * "Remember for 30 days" extends both the JWT expiry and the cookie max-age.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SukiHrmsWordmark } from '@/components/ui/SukiHrmsWordmark';
import { useToast } from '@/components/ui';

const BLUE = '#1d6fbf';
const BLUE_DEEP = '#0c4ea3';
const INK = '#1f2a37';
const MUTED = '#6b7280';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = `Login failed (${res.status})`;
        try {
          const data = JSON.parse(raw) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          if (raw.trim()) message = `${message}. Server response: ${raw.trim().slice(0, 160)}`;
        }
        throw new Error(message);
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'flex h-12 w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 transition focus-within:border-[#1d6fbf] focus-within:ring-2 focus-within:ring-[#1d6fbf]/15';

  return (
    <div className="min-h-screen bg-[#e8edf2] p-3 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[28px] bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] sm:min-h-[calc(100vh-2rem)]">
        {/* ── Left: form ───────────────────────────────────────────── */}
        <section className="relative flex w-full flex-col justify-center px-6 py-8 sm:px-10 md:w-[44%] md:px-12 lg:px-14">
          <div className="mx-auto flex w-full max-w-[400px] flex-col">
            <SukiHrmsWordmark accent="#2090FF" className="mb-8 h-16 w-auto self-start text-[#2090FF]" />
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK }}>
              Log in to your account
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: MUTED }}>
              Please enter your details
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-semibold" style={{ color: INK }}>
                  Email
                </label>
                <div className={field}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input
                    id="login-email"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    style={{ color: INK }}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-semibold" style={{ color: INK }}>
                  Password
                </label>
                <div className={field}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                    style={{ color: INK }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="shrink-0 p-0.5 transition hover:opacity-70"
                    style={{ color: MUTED }}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <path d="m2 2 20 20" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="login-remember" className="flex cursor-pointer select-none items-center gap-2.5 text-[13px]" style={{ color: MUTED }}>
                  <input
                    id="login-remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-[#1d6fbf]"
                  />
                  Remember for 30 days
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Ask your HR administrator to reset your password.')}
                  className="text-[13px] font-semibold transition hover:underline"
                  style={{ color: BLUE }}
                >
                  Forgot password
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-lg text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
                style={{ background: BLUE }}
              >
                {loading ? 'Signing in…' : 'Log In'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#9ca3af' }}>OR</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <button
              type="button"
              onClick={() => toast.info('SmartCard sign-in is not enabled. Use your email and password.')}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold transition hover:bg-gray-50"
              style={{ color: INK }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 15h4" />
              </svg>
              Log in with SmartCard
            </button>

            <p className="mt-8 text-center text-xs leading-5" style={{ color: '#9ca3af' }}>
            By signing in, you agree to your organisation&apos;s{' '}
            <button
              type="button"
              onClick={() => toast.info('Your organisation’s HR policy applies. Contact your administrator for the terms of use.')}
              className="font-medium underline underline-offset-2"
              style={{ color: BLUE }}
            >
              Terms of Use
            </button>
            </p>
          </div>
        </section>

        {/* ── Right: brand panel + tilted tablet ───────────────────── */}
        <section
          className="relative hidden min-w-0 flex-1 overflow-hidden md:block"
          style={{ background: `linear-gradient(165deg, #2f86e8 0%, ${BLUE} 38%, ${BLUE_DEEP} 100%)` }}
        >
          <div aria-hidden className="absolute -right-24 -top-32 h-[420px] w-[520px] rounded-full bg-white/10" />
          <div aria-hidden className="absolute -left-20 bottom-[-120px] h-[360px] w-[420px] rounded-full bg-black/10" />

          <div className="absolute left-10 top-10 z-10 max-w-[520px] xl:left-14 xl:top-12">
            <h2 className="text-[32px] font-semibold leading-[1.2] text-white xl:text-[38px]">
              Suki HRMS is a Seamless,
              <br />
              Intuitive &amp; Cloud-Based Platform
            </h2>
            <p className="mt-4 max-w-[420px] text-sm text-white/80">
              Attendance, leave, payroll and approvals — one workspace for your whole team.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-white/90">
              {['Employees', 'Workforce', 'Payroll', 'Approvals'].map((name) => (
                <span key={name} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {name}
                </span>
              ))}
            </div>
          </div>

          <HrmsTablet />
        </section>
      </div>
    </div>
  );
}

/**
 * Tilted tablet whose screen is a miniature of the real HRMS shell:
 * black sidebar, search top bar, KPI cards and an employee records table.
 */
function HrmsTablet() {
  const nav = [
    { label: 'Dashboard', active: true },
    { label: 'Employees', active: false },
    { label: 'Workforce', active: false },
    { label: 'Leave', active: false },
    { label: 'Payroll', active: false },
    { label: 'Approvals', active: false },
    { label: 'Recruitment', active: false },
    { label: 'Reports', active: false },
  ];
  const people = [
    { name: 'Ananya Rao', dept: 'HR', status: 'Present', tone: 'ok' as const },
    { name: 'Liam Chen', dept: 'Finance', status: 'Present', tone: 'ok' as const },
    { name: 'Sophia Patel', dept: 'Ops', status: 'On Leave', tone: 'leave' as const },
    { name: 'Noah Kim', dept: 'IT', status: 'Present', tone: 'ok' as const },
    { name: 'Emma Johnson', dept: 'Sales', status: 'Half Day', tone: 'half' as const },
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[-6%] right-[-6%] w-[92%] max-w-[860px] xl:bottom-[-4%] xl:right-[-2%]"
      style={{ transform: 'perspective(1400px) rotateY(-18deg) rotateX(6deg) rotateZ(-2deg)', transformOrigin: '70% 60%' }}
    >
      <div className="rounded-[28px] bg-[#111827] p-2.5 shadow-[0_50px_90px_-24px_rgba(4,20,50,0.7)]">
        <div className="mb-2 flex justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3a4454]" />
        </div>
        <div className="flex overflow-hidden rounded-[18px] bg-[#f4f7fb]" style={{ aspectRatio: '16 / 10.2' }}>
          {/* sidebar — matches the live app's black rail */}
          <div className="flex w-[27%] min-w-[108px] flex-col bg-black px-2.5 py-3 text-white">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold text-white" style={{ background: BLUE }}>
                S
              </span>
              <span className="text-[9px] font-semibold tracking-wide">Suki HRMS</span>
            </div>
            <div className="mb-2 h-5 rounded-md bg-white/10" />
            <p className="mb-1 px-1 text-[7px] font-semibold uppercase tracking-wider text-slate-500">General</p>
            <div className="space-y-0.5">
              {nav.slice(0, 5).map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8px]"
                  style={item.active ? { background: 'rgba(32,144,255,0.22)', color: '#fff' } : { color: '#94a3b8' }}
                >
                  <span className="h-1.5 w-1.5 rounded-sm" style={{ background: item.active ? BLUE : '#475569' }} />
                  {item.label}
                </div>
              ))}
            </div>
            <p className="mb-1 mt-2 px-1 text-[7px] font-semibold uppercase tracking-wider text-slate-500">Modules</p>
            <div className="space-y-0.5">
              {nav.slice(5).map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-sm bg-slate-600" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* main */}
          <div className="flex min-w-0 flex-1 flex-col p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 flex-1 items-center rounded-md bg-white px-2 text-[8px] text-slate-400 shadow-sm">
                Search employees, leave, payroll
              </div>
              <span className="h-5 w-5 rounded-full bg-slate-200" />
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: BLUE }}>
                A
              </span>
            </div>

            <p className="mt-2.5 text-[13px] font-bold text-slate-900">Welcome back</p>
            <p className="text-[8px] text-slate-400">Today&apos;s people operations</p>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[
                { label: 'Headcount', value: '248', hint: '+12 joined' },
                { label: 'Present', value: '231', hint: '93% marked' },
                { label: 'Approvals', value: '18', hint: 'leave · OT' },
                { label: 'Salary', value: '₹42L', hint: 'this month' },
              ].map((card) => (
                <div key={card.label} className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
                  <p className="text-[7px] text-slate-400">{card.label}</p>
                  <p className="text-[12px] font-bold leading-tight text-slate-900">{card.value}</p>
                  <p className="text-[7px]" style={{ color: BLUE }}>{card.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1.5">
                <p className="text-[9px] font-semibold text-slate-800">Employee Records</p>
                <p className="text-[7px] text-slate-400">Recently active</p>
              </div>
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-1 border-b border-slate-100 px-2 py-1 text-[7px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Name</span>
                <span>Dept</span>
                <span>Status</span>
              </div>
              {people.map((row) => (
                <div key={row.name} className="grid grid-cols-[1.4fr_0.8fr_0.8fr] items-center gap-1 border-b border-slate-50 px-2 py-1 text-[8px]">
                  <span className="truncate font-medium text-slate-800">{row.name}</span>
                  <span className="text-slate-500">{row.dept}</span>
                  <span
                    className="w-fit rounded-full px-1.5 py-0.5 text-[7px] font-semibold"
                    style={{
                      background: row.tone === 'ok' ? '#dcfce7' : row.tone === 'leave' ? '#fef3c7' : '#e0e7ff',
                      color: row.tone === 'ok' ? '#166534' : row.tone === 'leave' ? '#b45309' : '#3730a3',
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
