/**
 * Login page — /login
 * Email + password form. On success, redirects to home.
 *
 * Layout: a rounded card with a blue outline floating over soft blue blobs.
 * Left column is the form (underline inputs, show/hide password), right
 * column is an inline "dashboard & people" illustration. Self-contained
 * palette — the login screen is outside the app shell, so it doesn't use
 * the sidebar/accent tokens.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { useToast } from '@/components/ui';

const BLUE = '#3f6fd8';
const BLUE_SOFT = '#dfe7fa';
const BLUE_MID = '#a9bcf0';
const INK = '#2b3a67';
const MUTED = '#8a97b8';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // The API may fail before it can produce JSON (DB down, unhandled
        // exception), in which case the body is an HTML error page. Read it as
        // text first so the user sees the real reason instead of a parse error.
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

  const underlineInput =
    'h-10 w-full border-0 border-b bg-transparent px-0 text-sm outline-none transition focus:border-b-2';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5 sm:p-8 lg:p-10" style={{ background: '#f7f9ff' }}>
      {/* Background blobs (behind the card, bleeding off the corners like the mockup) */}
      <div aria-hidden className="pointer-events-none absolute -left-[18vw] top-[18vh] h-[70vh] w-[46vw] rounded-[45%] opacity-80" style={{ background: `radial-gradient(circle at 60% 40%, ${BLUE_MID}, #c5d3f5 60%, transparent 72%)` }} />
      <div aria-hidden className="pointer-events-none absolute -right-[14vw] -top-[22vh] h-[70vh] w-[42vw] rounded-[45%] opacity-80" style={{ background: `radial-gradient(circle at 40% 60%, ${BLUE_MID}, #c5d3f5 60%, transparent 72%)` }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-[26vh] right-[8vw] h-[60vh] w-[40vw] rounded-[45%] opacity-80" style={{ background: `radial-gradient(circle at 50% 30%, ${BLUE_MID}, #c5d3f5 60%, transparent 72%)` }} />

      {/* Card — fills the viewport minus the page padding */}
      <div
        className="relative grid w-full overflow-hidden rounded-[26px] bg-white lg:grid-cols-[minmax(320px,0.62fr)_1.38fr]"
        style={{
          border: `2px solid ${BLUE}`,
          boxShadow: '0 30px 80px -30px rgba(63,111,216,0.35)',
          minHeight: 'calc(100vh - 5rem)',
        }}
      >
        {/* Brand — black rounded badge with the themed SVG wordmark */}
        <div className="absolute left-8 top-6 z-20 sm:left-12">
          <div className="inline-flex items-center rounded-[28px] bg-black px-5 py-3.5 shadow-md">
            <BrandLogo size="xl" />
          </div>
        </div>
        {/* Floating disc near the brand */}
        <FloatingDisc className="absolute left-[32%] top-6 z-10 hidden h-20 w-20 lg:block" />

        {/* Form column */}
        <section className="flex flex-col justify-center px-8 pb-12 pt-24 sm:px-12 lg:pl-14">
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: INK }}>
            Login
          </h1>
          <p className="mb-8 mt-2 text-xs leading-5" style={{ color: MUTED }}>
            Welcome to Suki HRM — sign in to your HR operations workspace.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-xs font-semibold" style={{ color: INK }}>
                Email
              </label>
              <input
                id="login-email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@suki.hrms"
                className={underlineInput}
                style={{ borderColor: BLUE_MID, color: INK }}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-xs font-semibold" style={{ color: INK }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Please enter your password"
                  className={`${underlineInput} pr-8`}
                  style={{ borderColor: BLUE_MID, color: INK }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 transition hover:opacity-70"
                  style={{ color: MUTED }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <path d="m2 2 20 20" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-32 rounded-md text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: BLUE, boxShadow: '0 10px 20px -10px rgba(63,111,216,0.8)' }}
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p className="mt-10 text-[11px] leading-5" style={{ color: MUTED }}>
            Administrator access must be created in the configured database before first sign-in.
          </p>
        </section>

        {/* Illustration column */}
        <section className="relative hidden items-end justify-center overflow-hidden lg:flex">
          <DashboardIllustration />
        </section>
      </div>
    </div>
  );
}

/** The tilted glossy disc that floats near the brand in the mockup. */
function FloatingDisc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="discG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dfe7fa" />
          <stop offset="1" stopColor="#a9bcf0" />
        </linearGradient>
      </defs>
      <g transform="rotate(-28 50 50)">
        <ellipse cx="50" cy="56" rx="34" ry="14" fill="#8fa7e8" opacity="0.55" />
        <ellipse cx="50" cy="48" rx="34" ry="14" fill="url(#discG)" />
        <path d="M50 48 L84 48 A34 14 0 0 1 60 61 Z" fill="#3f6fd8" opacity="0.85" />
        <ellipse cx="50" cy="48" rx="34" ry="14" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
      </g>
    </svg>
  );
}

/**
 * Inline "people with a dashboard" illustration in the mockup's soft-blue
 * palette: layered blob/leaf backdrop, a tilted dashboard panel with a
 * sidebar, text rows, pie + legend and toggles, cylinders in front, and two
 * figures — one holding a bar chart, one pointing at the panel.
 */
function DashboardIllustration() {
  return (
    <svg viewBox="0 0 900 640" className="h-auto w-full max-w-[880px]" role="img" aria-label="Team reviewing an HR dashboard" preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="blobA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbe4fa" />
          <stop offset="1" stopColor="#9fb5ee" />
        </linearGradient>
        <linearGradient id="blobB" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c7d4f6" />
          <stop offset="1" stopColor="#eef2fc" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3f6fe" />
        </linearGradient>
        <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d6f7" />
          <stop offset="1" stopColor="#a9bcf0" />
        </linearGradient>
        <linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9d6f7" />
          <stop offset="0.5" stopColor="#eef2fc" />
          <stop offset="1" stopColor="#a9bcf0" />
        </linearGradient>
        <linearGradient id="cylDark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8fa7e8" />
          <stop offset="0.5" stopColor="#b9c9f3" />
          <stop offset="1" stopColor="#7f99e3" />
        </linearGradient>
        <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4f8f" />
          <stop offset="1" stopColor="#2b3a67" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#3f6fd8" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Backdrop: mountain blobs + leaves */}
      <path d="M120 520c-60-60-40-170 40-210 60-30 110 20 160-40 40-48 110-70 170-40 60 30 90 100 150 120 70 24 150 30 190 90 40 60-10 130-90 150-90 22-190-10-280 0-100 12-260 10-340-70z" fill="url(#blobA)" opacity="0.9" />
      <path d="M260 340c20-90 90-150 150-170 60-20 110 10 150 60 30 40 40 90 20 130H260z" fill="url(#blobB)" />
      <path d="M560 300c10-70 70-120 130-120 60 0 100 40 110 100 6 40-10 70-30 90H560z" fill="url(#blobB)" opacity="0.9" />
      <path d="M100 400c-20-40 10-90 50-100 30-8 60 10 70 40" fill="none" stroke="#b9c9f3" strokeWidth="14" strokeLinecap="round" />
      <path d="M150 470c-30-10-50-50-30-80" fill="none" stroke="#c9d6f7" strokeWidth="10" strokeLinecap="round" />
      <path d="M760 430c40-10 70-50 60-90" fill="none" stroke="#b9c9f3" strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="450" cy="560" rx="330" ry="26" fill="#3f6fd8" opacity="0.08" filter="url(#soft)" />

      {/* floating dots */}
      <circle cx="745" cy="120" r="12" fill="#a9bcf0" />
      <circle cx="300" cy="120" r="5" fill="#c9d6f7" />
      <circle cx="820" cy="300" r="4" fill="#c9d6f7" />

      {/* Dashboard panel (slightly tilted) */}
      <g transform="translate(330 170) rotate(-4)" filter="url(#shadow)">
        <rect x="0" y="0" width="360" height="250" rx="16" fill="url(#panel)" stroke="#c9d6f7" strokeWidth="2" />
        {/* sidebar rail */}
        <rect x="0" y="0" width="34" height="250" rx="16" fill="url(#rail)" />
        <rect x="16" y="0" width="18" height="250" fill="url(#rail)" />
        {[36, 68, 100, 132, 164].map((y, i) => (
          <circle key={y} cx="17" cy={y} r="7" fill={i === 0 ? '#3f6fd8' : '#eef2fc'} stroke="#8fa7e8" strokeWidth="1.5" />
        ))}
        {/* text block */}
        <rect x="54" y="26" width="110" height="10" rx="5" fill="#8fa7e8" />
        <rect x="54" y="48" width="86" height="7" rx="3.5" fill="#c9d6f7" />
        <rect x="54" y="64" width="120" height="7" rx="3.5" fill="#c9d6f7" />
        <rect x="54" y="80" width="70" height="7" rx="3.5" fill="#c9d6f7" />
        {/* button rows */}
        <rect x="54" y="104" width="60" height="16" rx="8" fill="#3f6fd8" />
        <rect x="120" y="104" width="46" height="16" rx="8" fill="#dfe7fa" />
        {/* stat blocks */}
        <rect x="54" y="132" width="50" height="34" rx="6" fill="#dfe7fa" />
        <rect x="112" y="132" width="50" height="34" rx="6" fill="#c9d6f7" />
        <rect x="60" y="140" width="24" height="6" rx="3" fill="#8fa7e8" />
        <rect x="118" y="140" width="30" height="6" rx="3" fill="#8fa7e8" />
        <rect x="60" y="152" width="36" height="6" rx="3" fill="#ffffff" />
        <rect x="118" y="152" width="20" height="6" rx="3" fill="#ffffff" />
        {/* bottom rows */}
        <rect x="54" y="186" width="110" height="7" rx="3.5" fill="#c9d6f7" />
        <rect x="54" y="202" width="90" height="7" rx="3.5" fill="#dfe7fa" />
        <rect x="54" y="218" width="120" height="7" rx="3.5" fill="#c9d6f7" />

        {/* pie chart */}
        <circle cx="250" cy="96" r="54" fill="#dfe7fa" />
        <path d="M250 96 L250 42 A54 54 0 0 1 303 88 Z" fill="#3f6fd8" />
        <path d="M250 96 L303 88 A54 54 0 0 1 262 149 Z" fill="#8fa7e8" />
        <path d="M250 96 L262 149 A54 54 0 0 1 200 110 Z" fill="#b9c9f3" />
        <circle cx="250" cy="96" r="18" fill="#ffffff" />
        {/* legend */}
        {[
          ['#3f6fd8', 64],
          ['#8fa7e8', 48],
          ['#b9c9f3', 40],
        ].map(([c, w], i) => (
          <g key={String(c)} transform={`translate(318 ${58 + i * 22})`}>
            <rect width="10" height="10" rx="3" fill={String(c)} />
            <rect x="14" y="2" width={Number(w)} height="6" rx="3" fill="#dfe7fa" />
          </g>
        ))}
        {/* toggles */}
        {[168, 190, 212].map((y, i) => (
          <g key={y} transform={`translate(226 ${y})`}>
            <rect width="34" height="14" rx="7" fill={i === 1 ? '#3f6fd8' : '#c9d6f7'} />
            <circle cx={i === 1 ? 26 : 8} cy="7" r="5" fill="#ffffff" />
            <rect x="42" y="4" width={70 - i * 10} height="6" rx="3" fill="#dfe7fa" />
          </g>
        ))}
      </g>

      {/* Cylinders / 3D bars in front of the panel */}
      <g transform="translate(455 430)">
        <rect x="0" y="40" width="26" height="80" fill="url(#cyl)" />
        <ellipse cx="13" cy="120" rx="13" ry="6" fill="#a9bcf0" />
        <ellipse cx="13" cy="40" rx="13" ry="6" fill="#eef2fc" stroke="#a9bcf0" />
        <rect x="32" y="10" width="26" height="110" fill="url(#cylDark)" />
        <ellipse cx="45" cy="120" rx="13" ry="6" fill="#7f99e3" />
        <ellipse cx="45" cy="10" rx="13" ry="6" fill="#c9d6f7" stroke="#7f99e3" />
        <rect x="64" y="58" width="26" height="62" fill="url(#cyl)" />
        <ellipse cx="77" cy="120" rx="13" ry="6" fill="#a9bcf0" />
        <ellipse cx="77" cy="58" rx="13" ry="6" fill="#eef2fc" stroke="#a9bcf0" />
      </g>

      {/* Person left: holding a bar-chart board */}
      <g transform="translate(200 300)">
        <path d="M58 150 L52 240" stroke="#2b3a67" strokeWidth="18" strokeLinecap="round" />
        <path d="M84 150 L92 240" stroke="#2b3a67" strokeWidth="18" strokeLinecap="round" />
        <path d="M40 244 h26" stroke="#3f6fd8" strokeWidth="9" strokeLinecap="round" />
        <path d="M86 244 h26" stroke="#3f6fd8" strokeWidth="9" strokeLinecap="round" />
        <path d="M42 70c0-14 12-24 30-24s30 10 30 24v70c0 14-10 24-30 24s-30-10-30-24z" fill="url(#suit)" />
        <circle cx="72" cy="30" r="22" fill="#f6d2c3" />
        <path d="M48 26c2-24 46-26 48-2v18c-4-4-6-10-8-14-8 6-26 6-34 0-2 4-4 10-6 14z" fill="#1f2a4d" />
        <path d="M50 28v22c0 4 4 6 8 4l-2-22z M94 28v22c0 4-4 6-8 4l2-22z" fill="#1f2a4d" />
        <g transform="translate(-6 118) rotate(-4)">
          <rect x="0" y="0" width="76" height="86" rx="8" fill="#ffffff" stroke="#c9d6f7" strokeWidth="2" filter="url(#shadow)" />
          {[
            [12, 34, 40],
            [26, 18, 56],
            [40, 44, 30],
            [54, 26, 48],
          ].map(([x, y, h], i) => (
            <rect key={x} x={x} y={y} width="8" height={h} rx="3" fill={i === 1 ? '#3f6fd8' : i === 3 ? '#8fa7e8' : '#b9c9f3'} />
          ))}
        </g>
        <path d="M46 84 L20 138" stroke="url(#suit)" strokeWidth="14" strokeLinecap="round" />
        <path d="M98 84 L70 136" stroke="url(#suit)" strokeWidth="14" strokeLinecap="round" />
        <circle cx="20" cy="140" r="7" fill="#f6d2c3" />
        <circle cx="70" cy="138" r="7" fill="#f6d2c3" />
      </g>

      {/* Person right: pointing at the panel */}
      <g transform="translate(700 290)">
        <path d="M30 150 L18 240" stroke="#2b3a67" strokeWidth="18" strokeLinecap="round" />
        <path d="M56 150 L66 240" stroke="#2b3a67" strokeWidth="18" strokeLinecap="round" />
        <path d="M6 244 h26" stroke="#3f6fd8" strokeWidth="9" strokeLinecap="round" />
        <path d="M60 244 h26" stroke="#3f6fd8" strokeWidth="9" strokeLinecap="round" />
        <path d="M14 70c0-14 12-24 30-24s30 10 30 24v70c0 14-10 24-30 24s-30-10-30-24z" fill="url(#suit)" />
        <circle cx="44" cy="30" r="22" fill="#f6d2c3" />
        <path d="M22 26c0-22 44-26 46-4-8-6-30-8-46 4z" fill="#1f2a4d" />
        <path d="M18 84 L-46 56" stroke="url(#suit)" strokeWidth="14" strokeLinecap="round" />
        <circle cx="-50" cy="54" r="7" fill="#f6d2c3" />
        <path d="M-52 52 l-12 -4" stroke="#f6d2c3" strokeWidth="5" strokeLinecap="round" />
        <path d="M72 84 L84 140" stroke="url(#suit)" strokeWidth="14" strokeLinecap="round" />
        <circle cx="86" cy="144" r="7" fill="#f6d2c3" />
      </g>

      {/* ground line */}
      <path d="M150 548 H770" stroke="#8fa7e8" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
