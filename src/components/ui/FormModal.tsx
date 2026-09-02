'use client';

import { useState, useEffect, useCallback } from 'react';
import Field, { FieldDef } from './Field';

interface FormModalProps {
  title: string;
  fields: FieldDef[];
  initialValues?: Record<string, string | number | boolean | undefined>;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number | boolean>) => Promise<void>;
  submitLabel?: string;
}

export default function FormModal({
  title,
  fields,
  initialValues,
  isOpen,
  onClose,
  onSubmit,
  submitLabel = 'Save',
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialValues) {
      setValues(initialValues);
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, initialValues]);

  const handleChange = useCallback((name: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    // Basic required-field validation (Zod validation happens in the API)
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required) {
        const v = values[f.name];
        if (v === undefined || v === '' || v === null) {
          newErrors[f.name] = `${f.label} is required`;
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit(values as Record<string, string | number | boolean>);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none hover:opacity-70"
            style={{ color: 'var(--foreground-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {fields.map((f) => (
            <Field
              key={f.name}
              def={f}
              value={values[f.name]}
              error={errors[f.name]}
              onChange={(v) => handleChange(f.name, v)}
            />
          ))}

          {submitError && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
            >
              {submitError}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
