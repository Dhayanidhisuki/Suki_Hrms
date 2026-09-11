'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchVisitorOptions, type VisitorOptions } from '@/lib/visitor-form-fields';

const CATEGORIES: { key: keyof VisitorOptions; label: string }[] = [
  { key: 'visitor_type', label: 'Visitor Type' },
  { key: 'visitor_purpose', label: 'Purpose' },
];

export default function VendorPage() {
  const router = useRouter();
  const [options, setOptions] = useState<VisitorOptions>({
    visitor_type: [],
    visitor_purpose: [],
    visitor_food_category: [],
    visitor_food_type: [],
    visitor_gadgets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setAllowed(data?.roleCode === 'company-admin' || data?.isSuperAdmin);
      })
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    if (allowed === false) router.replace('/visitor/gate-inward');
  }, [allowed, router]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setOptions(await fetchVisitorOptions());
    } catch {
      setError('Failed to load options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const addOption = async (category: string) => {
    const label = newLabel[category]?.trim();
    if (!label) return;
    setAdding(category); setError(null);
    try {
      const res = await fetch('/api/visitor/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, label }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Save failed');
      }
      setNewLabel((p) => ({ ...p, [category]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setAdding(null);
    }
  };

  if (allowed === null) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Checking access...</p>;
  }
  if (!allowed) {
    return <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Redirecting...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Vendor</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Manage Visitor Type and Purpose options</p>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="card p-5 space-y-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{cat.label}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel[cat.key] ?? ''}
                onChange={(e) => setNewLabel((p) => ({ ...p, [cat.key]: e.target.value }))}
                placeholder={`New ${cat.label.toLowerCase()}...`}
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              />
              <button
                onClick={() => addOption(cat.key)}
                disabled={adding === cat.key || !newLabel[cat.key]?.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {adding === cat.key ? 'Adding...' : 'Add'}
              </button>
            </div>

            <div className="space-y-1">
              {loading ? (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
              ) : options[cat.key].length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No entries yet.</p>
              ) : (
                options[cat.key].map((opt) => (
                  <div key={opt.value} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    <span>{opt.label}</span>
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{opt.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
