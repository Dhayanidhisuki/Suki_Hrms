/**
 * Employee Self Service — My Loans. Apply for a loan/advance, view
 * application status, active loans, outstanding balance, and repayment
 * schedule.
 */

'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';

interface LoanType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  minAmount: string | null;
  maxAmount: string | null;
}

interface Installment {
  id: number;
  installmentNumber: number;
  dueDate: string;
  totalAmount: string;
  status: string;
}

interface Loan {
  id: number;
  code: string;
  principal: string;
  tenureMonths: number;
  installmentAmount: string;
  outstandingBalance: string;
  installmentsPaid: number;
  status: string;
  createdAt: string;
  loanType: { code: string; name: string };
  installments: Installment[];
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  approved: { bg: '#dbeafe', fg: '#1e40af' },
  active: { bg: '#dcfce7', fg: '#166534' },
  closed: { bg: '#f1f5f9', fg: '#475569' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  written_off: { bg: '#f1f5f9', fg: '#475569' },
};

function money(v: string | number) {
  return Number(v).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function EssLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [types, setTypes] = useState<LoanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [form, setForm] = useState({ loanTypeId: '', principal: '', tenureMonths: '', remarks: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loansRes, typesRes] = await Promise.all([
        fetch('/api/workforce/my-loans'),
        fetch('/api/workforce/my-loans/types'),
      ]);
      if (!loansRes.ok) throw new Error((await loansRes.json().catch(() => ({}))).error ?? 'Failed to load loans');
      if (!typesRes.ok) throw new Error((await typesRes.json().catch(() => ({}))).error ?? 'Failed to load loan types');
      const loansJson = await loansRes.json();
      const typesJson = await typesRes.json();
      setLoans(loansJson.data ?? []);
      setTypes(typesJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function applyForLoan(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/workforce/my-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanTypeId: form.loanTypeId,
          principal: form.principal,
          tenureMonths: form.tenureMonths,
          remarks: form.remarks || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to submit application');
      }
      setForm({ loanTypeId: '', principal: '', tenureMonths: '', remarks: '' });
      setMessage('Loan application submitted for approval.');
      await fetchAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  const activeLoans = loans.filter((l) => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.outstandingBalance), 0);
  const selectedType = types.find((t) => String(t.id) === form.loanTypeId);

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Loans</h1>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Active Loans</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{activeLoans.length}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Outstanding Balance</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{money(totalOutstanding)}</div>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Total Applications</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{loans.length}</div>
            </div>
          </div>

          <form onSubmit={applyForLoan} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Apply for a Loan / Advance</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.loanTypeId}
                onChange={(e) => setForm({ ...form, loanTypeId: e.target.value })}
                required
              >
                <option value="">Select loan type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input
                className={inputClass}
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: e.target.value })}
                required
              />
              <input
                className={inputClass}
                style={inputStyle}
                type="number"
                min="1"
                placeholder="No. of months"
                value={form.tenureMonths}
                onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
                required
              />
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Remarks (optional)"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
            {selectedType && (selectedType.minAmount || selectedType.maxAmount) && (
              <div className="mt-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Permissible range: {selectedType.minAmount ? money(selectedType.minAmount) : 'No min'} – {selectedType.maxAmount ? money(selectedType.maxAmount) : 'No max'}
              </div>
            )}
            <button type="submit" disabled={submitting} className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>

          <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>My Applications &amp; Loans</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Tenure</th>
                  <th className="px-4 py-2">EMI</th>
                  <th className="px-4 py-2">Outstanding</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>No loan applications yet.</td></tr>
                )}
                {loans.map((l) => {
                  const tone = STATUS_TONE[l.status] ?? STATUS_TONE.pending;
                  const expanded = expandedId === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-2 font-medium">{l.code}</td>
                        <td className="px-4 py-2">{l.loanType.name}</td>
                        <td className="px-4 py-2">{money(l.principal)}</td>
                        <td className="px-4 py-2">{l.tenureMonths} mo</td>
                        <td className="px-4 py-2">{money(l.installmentAmount)}</td>
                        <td className="px-4 py-2">{money(l.outstandingBalance)}</td>
                        <td className="px-4 py-2">
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{l.status}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {l.installments.length > 0 && (
                            <button onClick={() => setExpandedId(expanded ? null : l.id)} className="text-xs text-blue-600 hover:underline">
                              {expanded ? 'Hide schedule' : 'View schedule'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                          <td colSpan={8} className="px-4 py-3" style={{ backgroundColor: 'var(--surface-muted, rgba(0,0,0,0.02))' }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left uppercase" style={{ color: 'var(--foreground-muted)' }}>
                                  <th className="py-1 pr-4">#</th>
                                  <th className="py-1 pr-4">Due Date</th>
                                  <th className="py-1 pr-4">Amount</th>
                                  <th className="py-1 pr-4">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {l.installments.map((i) => (
                                  <tr key={i.id}>
                                    <td className="py-1 pr-4">{i.installmentNumber}</td>
                                    <td className="py-1 pr-4">{new Date(i.dueDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                                    <td className="py-1 pr-4">{money(i.totalAmount)}</td>
                                    <td className="py-1 pr-4">{i.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
