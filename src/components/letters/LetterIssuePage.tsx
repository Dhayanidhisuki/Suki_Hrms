'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, PageHeader } from '@/components/ui';
import type { LetterType } from '@/lib/letters/generate-letter';

type LetterRow = {
  id: number;
  referenceNo: string;
  letterType: string;
  employeeId: number | null;
  applicantId: number | null;
  issuedDate: string;
  platformDocumentId: number | null;
  purpose: string | null;
};

const EXTRA: Record<string, Array<{ name: string; label: string; type?: string }>> = {
  OFFER_LETTER: [
    { name: 'ctcText', label: 'CTC text (e.g. Rs 6 Lakhs / Annum)' },
    { name: 'joinDate', label: 'Joining date', type: 'date' },
  ],
  APPOINTMENT_LETTER: [
    { name: 'ctcText', label: 'Gross / CTC text' },
    { name: 'effectiveDate', label: 'Effective date', type: 'date' },
  ],
  WARNING_LETTER: [
    { name: 'misconduct', label: 'Misconduct / remarks' },
    { name: 'absencePeriod', label: 'Dates / period' },
  ],
  SHOW_CAUSE: [
    { name: 'misconduct', label: 'Charge' },
    { name: 'absencePeriod', label: 'Particulars' },
    { name: 'explanationDeadline', label: 'Explanation deadline', type: 'date' },
  ],
  BONAFIDE: [{ name: 'purpose', label: 'Purpose (e.g. housing loan)' }],
  SERVICE_LETTER: [{ name: 'lastWorkingDay', label: 'Relieved on (blank if still serving)', type: 'date' }],
  COMPANY_RELIEVING: [{ name: 'lastWorkingDay', label: 'Last working day', type: 'date' }],
};

export default function LetterIssuePage({
  letterType,
  title,
  description,
  ownerKind,
}: {
  letterType: LetterType;
  title: string;
  description: string;
  ownerKind: 'EMPLOYEE' | 'CANDIDATE';
}) {
  const [rows, setRows] = useState<LetterRow[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/letters?letterType=${letterType}`);
    if (res.ok) setRows((await res.json()).data ?? []);
  }, [letterType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      if (ownerKind === 'EMPLOYEE') {
        const url = q ? `/api/employees?search=${encodeURIComponent(q)}&limit=15` : '/api/employees?limit=15';
        fetch(url)
          .then((r) => r.json())
          .then((json) =>
            setOptions(
              (json.data ?? []).map((e: { id: number; employeeCode: string; firstName: string; lastName: string }) => ({
                id: e.id,
                label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
              })),
            ),
          )
          .catch(() => setOptions([]));
      } else {
        const url = q ? `/api/recruitment/applicants?search=${encodeURIComponent(q)}` : '/api/recruitment/applicants';
        fetch(url)
          .then((r) => r.json())
          .then((json) =>
            setOptions(
              (json.data ?? []).map((a: { id: number; applicationNo: string; firstName: string; lastName: string }) => ({
                id: a.id,
                label: `${a.applicationNo} — ${a.firstName} ${a.lastName}`,
              })),
            ),
          )
          .catch(() => setOptions([]));
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, ownerKind]);

  const issue = async () => {
    setError(null);
    if (!ownerId) {
      setError('Select a person');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { letterType, ...extra };
      if (ownerKind === 'EMPLOYEE') body.employeeId = Number(ownerId);
      else body.applicantId = Number(ownerId);
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Issue failed');
      await load();
      if (json.platformDocumentId) {
        window.open(`/api/platform/document/${json.platformDocumentId}/download`, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Issue failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} eyebrow="Letters" />
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder={ownerKind === 'EMPLOYEE' ? 'Search employee' : 'Search applicant'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="w-full rounded-lg border px-3 py-2 text-sm" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">Select {ownerKind === 'EMPLOYEE' ? 'employee' : 'applicant'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {(EXTRA[letterType] ?? []).map((f) => (
          <label key={f.name} className="block text-sm">
            <span style={{ color: 'var(--foreground-muted)' }}>{f.label}</span>
            <input
              type={f.type ?? 'text'}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={extra[f.name] ?? ''}
              onChange={(e) => setExtra((x) => ({ ...x, [f.name]: e.target.value }))}
            />
          </label>
        ))}
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button type="button" variant="primary" loading={busy} onClick={issue}>
          Generate and archive
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
            <th className="py-2">Reference</th>
            <th>Issued</th>
            <th>Purpose</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2 font-medium">{r.referenceNo}</td>
              <td>{String(r.issuedDate).slice(0, 10)}</td>
              <td>{r.purpose ?? '—'}</td>
              <td>
                {r.platformDocumentId ? (
                  <a href={`/api/platform/document/${r.platformDocumentId}/download`} className="text-sm" style={{ color: 'var(--accent)' }}>
                    Download
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
