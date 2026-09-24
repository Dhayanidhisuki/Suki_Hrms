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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui';

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
  const toast = useToast();

  const [regime, setRegime] = useState<Regime>('NEW');
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const latestForYear = currentFinancialYear
    ? declarations.find((d) => d.financialYear === currentFinancialYear)
    : undefined;

  const handleSubmit = async () => {
    if (!currentFinancialYear) return;
    setSubmitting(true);
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
      toast.success('Declaration submitted for HR approval.');
      setForm(INITIAL_FORM);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Income Tax — Regime &amp; Investment Declaration</h1>

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

              {/* Old-regime deductions have to be evidenced. Without an upload
                  path the employee could declare but never prove, which is the
                  usual reason HR rejects a declaration. Proofs attach only
                  while the declaration is still awaiting review. */}
              {latestForYear.regime === 'OLD' && (
                <ProofSection declarationId={latestForYear.id} editable={latestForYear.status === 'pending_hr'} />
              )}
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

const PROOF_SECTIONS = ['80C', '80D', '80CCD', '80G', '80E', '80TTA', 'HRA', 'OTHER'] as const;

interface Proof {
  id: number;
  declarationId: number;
  section: string;
  amount: number;
  description: string | null;
  documentUrl: string | null;
  status: string;
  rejectionReason: string | null;
}

const PROOF_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef9c3', fg: '#854d0e' },
  verified: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};

function ProofSection({ declarationId, editable }: { declarationId: number; editable: boolean }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [section, setSection] = useState<string>('80C');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/workforce/my-tds-proofs');
    if (!res.ok) return;
    const json: { data: Proof[] } = await res.json();
    // The endpoint returns every proof this employee has filed; show only the
    // ones belonging to the declaration on screen.
    setProofs((json.data ?? []).filter((p) => p.declarationId === declarationId));
  }, [declarationId]);

  useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) < 0) { toast.error('Enter the amount this proof covers.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('declarationId', String(declarationId));
      fd.set('section', section);
      fd.set('amount', amount);
      if (description) fd.set('description', description);
      const f = fileRef.current?.files?.[0];
      if (f) fd.set('file', f);
      const res = await fetch('/api/workforce/my-tds-proofs', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Upload failed');
      setAmount(''); setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
      toast.success('Proof uploaded successfully.');
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : 'Upload failed');
    } finally { setBusy(false); }
  };

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Investment Proofs</h3>
      <p className="mb-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
        Old-regime deductions need evidence. HR verifies each proof before approving the declaration.
      </p>

      {proofs.length > 0 && (
        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
              <th className="py-1 pr-3">Section</th><th className="py-1 pr-3">Amount</th>
              <th className="py-1 pr-3">Description</th><th className="py-1 pr-3">File</th><th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {proofs.map((p) => {
              const tone = PROOF_TONE[p.status] ?? { bg: '#f1f5f9', fg: '#475569' };
              return (
                <tr key={p.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-1 pr-3">{p.section}</td>
                  <td className="py-1 pr-3">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="py-1 pr-3">{p.description ?? '—'}</td>
                  <td className="py-1 pr-3">
                    {p.documentUrl ? <a href={p.documentUrl} className="text-xs font-medium" style={{ color: 'var(--primary)' }}>View</a> : '—'}
                  </td>
                  <td className="py-1">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{p.status}</span>
                    {p.rejectionReason && <span className="ml-2 text-xs" style={{ color: '#991b1b' }}>({p.rejectionReason})</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editable ? (
        <form onSubmit={add} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <select value={section} onChange={(e) => setSection(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle}>
            {PROOF_SECTIONS.map((sx) => <option key={sx} value={sx}>{sx}</option>)}
          </select>
          <input type="number" min="0" step="1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" style={inputStyle} />
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="rounded-lg border px-2 py-1 text-sm" style={inputStyle} />
          <button type="submit" disabled={busy} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
            {busy ? 'Adding…' : 'Add Proof'}
          </button>
        </form>
      ) : (
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          This declaration has already been reviewed — proofs can no longer be added to it.
        </p>
      )}
    </div>
  );
}
