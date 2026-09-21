/**
 * Attendance Policy — company-scoped single-row config for break rules,
 * grace periods, and half-day rules.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

export default function AttendancePolicyPage() {
  const toast = useToast();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/attendance-policy');
      if (res.ok) setConfig(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      breakMinutesPerDay: Number(formData.get('breakMinutesPerDay')),
      breakDeductible: formData.get('breakDeductible') === 'on',
      lateGraceMinutes: Number(formData.get('lateGraceMinutes')),
      earlyOutGraceMinutes: Number(formData.get('earlyOutGraceMinutes')),
      halfDayMinHours: formData.get('halfDayMinHours') ? Number(formData.get('halfDayMinHours')) : null,
      halfDayMaxHours: formData.get('halfDayMaxHours') ? Number(formData.get('halfDayMaxHours')) : null,
      minFullDayHours: Number(formData.get('minFullDayHours')),
      autoAbsentIfNoPunch: formData.get('autoAbsentIfNoPunch') === 'on',
    };
    const res = await fetch('/api/masters/attendance-policy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (res.ok) { setConfig(await res.json()); toast.success('Saved'); }
    else toast.error('Failed');
    setSaving(false);
  };

  if (loading) return <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>;

  return (
    <div className="space-y-6">
      <MasterGroupTabs groupLabel="Workforce" />
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Policy</h1>
      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Break Minutes Per Day</label>
          <input type="number" name="breakMinutesPerDay" defaultValue={config?.breakMinutesPerDay as number ?? 30} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" name="breakDeductible" defaultChecked={config?.breakDeductible as boolean ?? false} />
            Break is deductible from pay
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Late Grace Minutes</label>
          <input type="number" name="lateGraceMinutes" defaultValue={config?.lateGraceMinutes as number ?? 0} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Early Out Grace Minutes</label>
          <input type="number" name="earlyOutGraceMinutes" defaultValue={config?.earlyOutGraceMinutes as number ?? 0} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Half-Day Min Hours (blank = no rule)</label>
          <input type="number" name="halfDayMinHours" defaultValue={config?.halfDayMinHours as number ?? ''} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Half-Day Max Hours (blank = no rule)</label>
          <input type="number" name="halfDayMaxHours" defaultValue={config?.halfDayMaxHours as number ?? ''} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Min Full Day Hours</label>
          <input type="number" name="minFullDayHours" defaultValue={config?.minFullDayHours as number ?? 8} className="mt-1 block w-full rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" name="autoAbsentIfNoPunch" defaultChecked={config?.autoAbsentIfNoPunch as boolean ?? false} />
            Auto-absent if no punch
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}
