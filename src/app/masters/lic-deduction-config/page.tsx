/**
 * LIC Deduction Config — company-scoped single-row config.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export default function LicDeductionConfigPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/lic-deduction-config');
      if (res.ok) setConfig(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      deductionType: formData.get('deductionType'),
      amount: Number(formData.get('amount')),
      minAmount: Number(formData.get('minAmount')),
      maxAmount: formData.get('maxAmount') ? Number(formData.get('maxAmount')) : null,
      isActive: formData.get('isActive') === 'on',
    };
    const res = await fetch('/api/masters/lic-deduction-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (res.ok) { setConfig(await res.json()); alert('Saved'); }
    else alert('Failed');
    setSaving(false);
  };

  if (loading) return <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>LIC Deduction Config</h1>
      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Deduction Type</label>
          <select name="deductionType" defaultValue={config?.deductionType as string ?? 'FLAT'} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <option value="FLAT">Flat Amount</option>
            <option value="PERCENT">Percentage of Gross</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Amount / Percentage</label>
          <input type="number" name="amount" defaultValue={config?.amount as number ?? 0} step="0.01" className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} required />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Minimum Amount</label>
          <input type="number" name="minAmount" defaultValue={config?.minAmount as number ?? 0} step="0.01" className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Maximum Amount (blank = no cap)</label>
          <input type="number" name="maxAmount" defaultValue={config?.maxAmount as number ?? ''} step="0.01" className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" name="isActive" defaultChecked={config?.isActive as boolean ?? true} />
            Active
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}
