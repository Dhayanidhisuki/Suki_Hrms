/**
 * Login page — /login
 * Email + password form. On success, redirects to home.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]" style={{ background: 'var(--background)' }}>
      <section className="hidden flex-col justify-between bg-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] font-black text-white">S</span><span className="font-semibold">Suki HRMS</span></div>
        <div className="max-w-xl"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">People operations</p><h1 className="text-5xl font-bold leading-tight tracking-tight">One workspace for your employee lifecycle.</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-400">Manage people, masters, documents, and access controls through a focused HR operations platform.</p></div>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Suki HRMS</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] font-black text-white">S</span><span className="font-semibold">Suki HRMS</span></div></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>Secure access</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Welcome back</h1>
          <p className="mb-8 mt-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>Sign in with your administrator account.</p>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Email
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@suki.hrms"
                className="h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border px-3 text-sm outline-none transition focus:ring-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-7 rounded-lg border px-4 py-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground-muted)' }}>
            Administrator access must be created in the configured database before first sign-in.
          </div>
        </div>
      </section>
    </div>
  );
}
