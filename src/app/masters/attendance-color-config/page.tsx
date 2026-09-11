/**
 * Attendance Color Config — company-scoped single-row config for the
 * color thresholds used by the monthly attendance grid.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FormModal, type FieldDef } from '@/components/ui';

interface ColorConfig {
  zeroHoursColor: string;
  shortHoursColor: string;
  shortHoursThreshold: number;
  partialHoursColor: string;
  partialHoursThreshold: number;
  normalHoursColor: string;
  normalHoursThreshold: number;
  extendedHoursColor: string;
  weeklyOffColor: string;
}

const fields: FieldDef[] = [
  { name: 'zeroHoursColor', label: 'Zero Hours Color', type: 'text', required: true, placeholder: '#ef4444' },
  { name: 'shortHoursColor', label: 'Short Hours Color', type: 'text', required: true, placeholder: '#f97316' },
  { name: 'shortHoursThreshold', label: 'Short Hours Threshold (hrs)', type: 'number', required: true },
  { name: 'partialHoursColor', label: 'Partial Hours Color', type: 'text', required: true, placeholder: '#eab308' },
  { name: 'partialHoursThreshold', label: 'Partial Hours Threshold (hrs)', type: 'number', required: true },
  { name: 'normalHoursColor', label: 'Normal Hours Color', type: 'text', required: true, placeholder: '#22c55e' },
  { name: 'normalHoursThreshold', label: 'Normal Hours Threshold (hrs)', type: 'number', required: true },
  { name: 'extendedHoursColor', label: 'Extended Hours Color', type: 'text', required: true, placeholder: '#15803d' },
  { name: 'weeklyOffColor', label: 'Weekly Off Color', type: 'text', required: true, placeholder: '#3b82f6' },
];

export default function AttendanceColorConfigPage() {
  const [config, setConfig] = useState<ColorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/masters/attendance-color-config');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setConfig(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const res = await fetch('/api/masters/attendance-color-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) { setModalOpen(false); fetchData(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed'); }
  };

  const swatches: Array<{ label: string; color: string; threshold?: number }> = config ? [
    { label: 'Zero Hours', color: config.zeroHoursColor },
    { label: `Short (< ${config.shortHoursThreshold}h)`, color: config.shortHoursColor, threshold: config.shortHoursThreshold },
    { label: `Partial (< ${config.partialHoursThreshold}h)`, color: config.partialHoursColor, threshold: config.partialHoursThreshold },
    { label: `Normal (≥ ${config.normalHoursThreshold}h)`, color: config.normalHoursColor, threshold: config.normalHoursThreshold },
    { label: 'Extended', color: config.extendedHoursColor },
    { label: 'Weekly Off', color: config.weeklyOffColor },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attendance Color Config</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Configure color thresholds for the monthly attendance grid.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Edit Config
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>}

      {config && !loading && (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Color Legend</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {swatches.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg border" style={{ backgroundColor: s.color, borderColor: 'var(--border)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{s.label}</p>
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{s.color}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Edit Color Config"
        fields={fields}
        initialValues={config as unknown as Record<string, string | number | boolean> | undefined}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
