/**
 * Employee Self Service — Income Tax / TDS Investment Declaration.
 * Self-service: always the logged-in user's own employee record, resolved
 * server-side (never taken from the client). An employee picks their
 * regime for the financial year — Old (with 80C/80D/etc. deductions and
 * HRA exemption) or New (standard deduction auto-applied, only "other
 * income" declared) — and submits it for HR approval.
 *
 * Submitting again for the same financial year creates a new declaration
 * rather than editing the old one, so the approval history is preserved;
 * the latest APPROVED row is what payroll's TDS engine actually uses.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

type Regime = 'OLD' | 'NEW';

interface Declaration {
  id: number;
  financialYear: number;
  regime: Regime;
  section80C: string;
  section80D: string;
  section80CCD: string;
  section80G: string;
  section80E: string;
  section80TTA: string;
  otherDeductions: string;
  hraExemption: string;
  otherIncome: string;
  status: string;
  rejectionReason: string | null;
  remarks: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_hr: { bg: '#fef9c3', fg: '#854d0e' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};

const OLD_REGIME_FIELDS: { key: keyof typeof INITIAL_FORM; label: string; help: string; max?: number }[] = [
  { key: 'section80C', label: 'Section 80C', help: 'PF, ELSS, LIC, PPF, etc.', max: 150000 },
  { key: 'section80D', label: 'Section 80D', help: 'Health insurance premium', max: 100000 },
  { key: 'section80CCD', label: 'Section 80CCD', help: 'NPS contribution', max: 50000 },
  { key: 'hraExemption', label: 'HRA Exemption', help: 'Claimed HRA exemption' },
  { key: 'section80G', label: 'Section 80G', help: 'Donations' },
  { key: 'section80E', label: 'Section 80E', help: 'Education loan interest' },
  { key: 'section80TTA', label: 'Section 80TTA', help: 'Savings account interest', max: 10000 },
  { key: 'otherDeductions', label: 'Other Deductions', help: 'Any other declared deduction' },
];

const INITIAL_FORM = {
  section80C: '', section80D: '', section80CCD: '', section80G: '', section80E: '',
  section80TTA: '', otherDeductions: '', hraExemption: '', otherIncome: '', remarks: '',
};

function fmt(n: string | number) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

export default function IncomeTaxPage() {
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [currentFinancialYear, setCurrentFinancialYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [regime, setRegime] = useState<Regime>('NEW');
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/tds-declaration?scope=mine');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load');
      }
      const json = await res.json();
      setDeclarations(json.data ?? []);
      setCurrentFinancialYear(json.currentFinancialYear ?? null);
      setRegime(json.defaultRegime === 'OLD' ? 'OLD' : 'NEW');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const latestForYear = currentFinancialYear
    ? declarations.find((d) => d.financialYear === currentFinancialYear)
    : undefined;

  const handleSubmit = async () => {
    if (!currentFinancialYear) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {
        financialYear: currentFinancialYear,
        regime,
        otherIncome: form.otherIncome || 0,
        remarks: form.remarks || undefined,
      };
      if (regime === 'OLD') {
        for (const f of OLD_REGIME_FIELDS) body[f.key] = form[f.key] || 0;
      }
      const res = await fetch('/api/workforce/tds-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Submission failed');
      }
      setSaved(true);
      setForm(INITIAL_FORM);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Income Tax — Regime &amp; Investment Declaration</h1>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">Declaration submitted for HR approval.</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          {latestForYear && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Current declaration — FY {currentFinancialYear}-{String((currentFinancialYear ?? 0) + 1).slice(-2)}
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: STATUS_TONE[latestForYear.status]?.bg, color: STATUS_TONE[latestForYear.status]?.fg }}
                >
                  {latestForYear.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                Regime: <strong>{latestForYear.regime}</strong>
                {latestForYear.regime === 'OLD' && (
                  <> · 80C ₹{fmt(latestForYear.section80C)} · 80D ₹{fmt(latestForYear.section80D)} · HRA ₹{fmt(latestForYear.hraExemption)}</>
                )}
                {latestForYear.regime === 'NEW' && latestForYear.otherIncome !== '0' && <> · Other income ₹{fmt(latestForYear.otherIncome)}</>}
              </p>
              {latestForYear.status === 'rejected' && latestForYear.rejectionReason && (
                <p className="mt-1 text-sm text-red-600">Rejected: {latestForYear.rejectionReason}</p>
              )}
              <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Submitting a new declaration below replaces this one for FY {currentFinancialYear}.
              </p>
            </div>
          )}

          <div className="rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {latestForYear ? 'Amend declaration' : 'New declaration'} — FY {currentFinancialYear}-{String((currentFinancialYear ?? 0) + 1).slice(-2)}
            </h2>

            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                Tax Regime
              </label>
              <div className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                {(['OLD', 'NEW'] as Regime[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegime(r)}
                    className="px-6 py-2 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: regime === r ? 'var(--primary)' : 'var(--surface)',
                      color: regime === r ? '#fff' : 'var(--foreground)',
                    }}
                  >
                    {r === 'OLD' ? 'Old Regime' : 'New Regime'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {regime === 'OLD'
                  ? 'Old Regime lets you claim deductions (80C, 80D, HRA, etc.) against your taxable income.'
                  : 'New Regime applies a flat standard deduction automatically — no investment proofs needed.'}
              </p>
            </div>

            {regime === 'OLD' ? (
              <div className="grid grid-cols-2 gap-4">
                {OLD_REGIME_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {f.label}{f.max ? ` (max ₹${f.max.toLocaleString('en-IN')})` : ''}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={f.max}
                      value={form[f.key]}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                    />
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>{f.help}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-sm">
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Other Income</label>
                <input
                  type="number"
                  min={0}
                  value={form.otherIncome}
                  onChange={(e) => setForm((s) => ({ ...s, otherIncome: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                />
                <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>e.g. interest income — increases taxable income</p>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Remarks (optional)</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm((s) => ({ ...s, remarks: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !currentFinancialYear}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {submitting ? 'Submitting…' : 'Submit Declaration'}
            </button>
          </div>

          {declarations.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Declaration History</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                    <th className="py-2">FY</th>
                    <th className="py-2">Regime</th>
                    <th className="py-2">Submitted</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {declarations.map((d) => (
                    <tr key={d.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">{d.financialYear}-{String(d.financialYear + 1).slice(-2)}</td>
                      <td className="py-2">{d.regime}</td>
                      <td className="py-2">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: STATUS_TONE[d.status]?.bg, color: STATUS_TONE[d.status]?.fg }}
                        >
                          {d.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
