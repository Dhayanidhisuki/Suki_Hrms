/**
 * Employee ID Configuration — singleton config page (BRD §9).
 * Company sets the Employee ID numbering format.
 */

'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui';

interface Config {
  id: number;
  prefix: string;
  includeYear: boolean;
  includeDepartment: boolean;
  sequenceLength: number;
  separator: string;
  startNumber: number;
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

export default function EmployeeIdConfigPage() {
  const toast = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/masters/employee-id-config')
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => toast.error('Failed to load config'))
      .finally(() => setLoading(false));
  }, [toast]);

  const submit = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/masters/employee-id-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      setConfig(await res.json());
      toast.success('Configuration saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>;

  const preview = () => {
    if (!config) return '';
    const parts = [config.prefix];
    if (config.includeYear) parts.push('2026');
    if (config.includeDepartment) parts.push('DEPT');
    parts.push(String(config.startNumber).padStart(config.sequenceLength, '0'));
    return parts.join(config.separator);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Employee ID Configuration</h1>

      {config && (
        <div className="space-y-4 rounded-xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Prefix</label>
            <input className={inputClass} style={inputStyle} value={config.prefix} onChange={(e) => setConfig({ ...config, prefix: e.target.value })} placeholder="KUN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Separator</label>
              <input className={inputClass} style={inputStyle} value={config.separator} onChange={(e) => setConfig({ ...config, separator: e.target.value })} placeholder="-" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Sequence Length</label>
              <input type="number" min={1} max={10} className={inputClass} style={inputStyle} value={config.sequenceLength} onChange={(e) => setConfig({ ...config, sequenceLength: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Start Number</label>
              <input type="number" min={0} className={inputClass} style={inputStyle} value={config.startNumber} onChange={(e) => setConfig({ ...config, startNumber: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <input type="checkbox" checked={config.includeYear} onChange={(e) => setConfig({ ...config, includeYear: e.target.checked })} />
              Include Year
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <input type="checkbox" checked={config.includeDepartment} onChange={(e) => setConfig({ ...config, includeDepartment: e.target.checked })} />
              Include Department Code
            </label>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Preview: </span>
            <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>{preview()}</span>
          </div>
          <button onClick={submit} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}
