/**
 * Reusable single-row config page for company-scoped settings (Phase 2A).
 * Unlike SlabPage (list CRUD), this is a single form that loads one config
 * row (or defaults) and saves via PUT. Used by LomConfig, RoundingConfig,
 * PayrollValidationConfig, PayrollWorkflowConfig, PayrollDisplayConfig.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Field, type FieldDef } from '@/components/ui';

interface SingleConfigPageProps {
  title: string;
  description: string;
  apiPath: string;
  fields: FieldDef[];
}

export default function SingleConfigPage({ title, description, apiPath, fields }: SingleConfigPageProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setValues(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? 'Failed to save');
      }
      const json = await res.json();
      setValues(json);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (name: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>{description}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          Saved successfully.
        </div>
      )}

      <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <Field
              key={field.name}
              def={field}
              value={values[field.name] ?? undefined}
              onChange={(v) => updateField(field.name, v)}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={fetchData}
            disabled={saving}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
