/**
 * Reusable single-row config page for company-scoped settings (Phase 2A).
 * Unlike SlabPage (list CRUD), this is a single form that loads one config
 * row (or defaults) and saves via PUT. Used by LomConfig, RoundingConfig,
 * PayrollValidationConfig, PayrollWorkflowConfig, PayrollDisplayConfig.
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Field, useToast, type FieldDef } from '@/components/ui';
import { CircleCheck } from 'lucide-react';

/** A named group of fields, rendered as its own card with a heading. */
export interface ConfigSection {
  title: string;
  description?: string;
  icon?: ReactNode;
  fields: FieldDef[];
}

interface SingleConfigPageProps {
  title: string;
  description: string;
  apiPath: string;
  /** Flat field list — the original shape, still supported for the 5 pages
   * that don't need grouping. */
  fields?: FieldDef[];
  /** Grouped alternative to `fields`, for a policy page with distinct rule
   * clusters (grace rules vs. thresholds vs. toggles). Takes precedence over
   * `fields` when both are given. */
  sections?: ConfigSection[];
  icon?: ReactNode;
  /** Short affirmative chip next to the title, e.g. "Policy Active & Enforced". */
  statusLabel?: string;
}

export default function SingleConfigPage({
  title,
  description,
  apiPath,
  fields,
  sections,
  icon,
  statusLabel,
}: SingleConfigPageProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setValues(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiPath, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
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
      toast.success('Saved successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
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
      <div className="flex flex-wrap items-center gap-2.5">
        {icon && (
          <span className="[&_svg]:h-6 [&_svg]:w-6" style={{ color: 'var(--primary)' }}>
            {icon}
          </span>
        )}
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h1>
        {statusLabel && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
          >
            <CircleCheck className="h-3.5 w-3.5" />
            {statusLabel}
          </span>
        )}
      </div>
      <p className="-mt-3 text-sm" style={{ color: 'var(--foreground-muted)' }}>{description}</p>

      {sections ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-xl border p-6"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <div className="mb-4 flex items-start gap-3">
                {section.icon && (
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4.5 [&_svg]:w-4.5"
                    style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                  >
                    {section.icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{section.title}</h2>
                  {section.description && (
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>{section.description}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <Field
                    key={field.name}
                    def={field}
                    value={values[field.name] ?? undefined}
                    onChange={(v) => updateField(field.name, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(fields ?? []).map((field) => (
              <Field
                key={field.name}
                def={field}
                value={values[field.name] ?? undefined}
                onChange={(v) => updateField(field.name, v)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {typeof values.updatedAt === 'string' && values.updatedAt
            ? `Last updated: ${new Date(values.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : ''}
        </p>
        <div className="flex gap-3">
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
