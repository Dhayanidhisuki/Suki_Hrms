/**
 * Bank File Generation — select a payroll run and template, download the
 * bank transfer file. Shows missing bank details warning.
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface BankFileTemplate {
  id: number;
  code: string;
  name: string;
  bankName: string;
  fileFormat: string;
}

interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: string;
}

export default function BankFilePage() {
  return (
    <Suspense fallback={<div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}>
      <BankFileContent />
    </Suspense>
  );
}

function BankFileContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [templates, setTemplates] = useState<BankFileTemplate[]>([]);
  const [selectedRun, setSelectedRun] = useState(runId ?? '');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, templatesRes] = await Promise.all([
        fetch('/api/payroll/runs'),
        fetch('/api/masters/bank-file-templates'),
      ]);
      const runsJson = await runsRes.json();
      const templatesJson = await templatesRes.json();
      setRuns(runsJson.data ?? []);
      setTemplates(templatesJson.data ?? []);
      if (templatesJson.data?.length > 0 && !selectedTemplate) {
        setSelectedTemplate(String(templatesJson.data[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = () => {
    if (!selectedRun || !selectedTemplate) return;
    window.open(`/api/payroll/runs/${selectedRun}/bank-file?templateId=${selectedTemplate}`, '_blank');
  };

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Bank File Generation</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Generate a bank transfer file for a payroll run. Configure templates under{' '}
          <Link href="/masters/bank-file-templates" className="underline">Masters {'>'} Bank File Templates</Link>.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {templates.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          No bank file templates configured.{' '}
          <Link href="/masters/bank-file-templates" className="underline font-medium">Create one here</Link>.
        </div>
      )}

      <div className="rounded-xl border p-6 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Payroll Run</label>
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
            >
              <option value="">Select a run…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.year}-{String(r.month).padStart(2, '0')} ({r.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.bankName})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleDownload}
            disabled={!selectedRun || !selectedTemplate}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Download Bank File
          </button>
        </div>
      </div>
    </div>
  );
}
