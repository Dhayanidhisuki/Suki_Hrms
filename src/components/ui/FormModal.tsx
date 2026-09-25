'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Field, { FieldDef } from './Field';

interface FormModalProps {
  title: string;
  fields: FieldDef[];
  initialValues?: Record<string, string | number | boolean | undefined>;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number | boolean>) => Promise<void>;
  submitLabel?: string;
  children?: React.ReactNode;
  /**
   * Called once, right after a specific field changes (before compute), with
   * that field's new value and the form's other current values — for a
   * one-time "suggest a value" prefill on a different, still-freely-editable
   * field (e.g. picking an Employee suggests their office/personal email,
   * but the admin can still type over it afterward). Unlike `compute`, the
   * returned value isn't reapplied on later unrelated changes, so it never
   * fights a manual edit. Return a partial values object to merge, or
   * nothing to leave the rest of the form untouched.
   */
  onFieldChange?: (
    name: string,
    value: string | number | boolean,
    values: Record<string, string | number | boolean | undefined>
  ) => Record<string, string | number | boolean | undefined> | void;
}

export default function FormModal({
  title,
  fields,
  initialValues,
  isOpen,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  children,
  onFieldChange,
}: FormModalProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Mirrors `values` synchronously so handleChange can read the latest state
  // without the functional setState form — needed because onFieldChange may
  // itself call setState on the CALLER's component (e.g. to mirror a field
  // into local state). Calling that from inside setValues's updater trips
  // React's "Cannot update a component while rendering a different
  // component" check, since the updater runs as part of this component's
  // state-update pass. Reading/writing a ref outside setValues keeps
  // onFieldChange as a plain synchronous call from the event handler, which
  // is always safe.
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const applyComputedFields = useCallback(
    (v: Record<string, string | number | boolean | undefined>) => {
      let next = v;
      for (const f of fields) {
        if (!f.compute) continue;
        const computed = f.compute(next);
        if (next[f.name] !== computed) next = { ...next, [f.name]: computed };
      }
      return next;
    },
    [fields]
  );

  useEffect(() => {
    if (isOpen && initialValues) {
      // A field's defaultValue is a fallback for whatever the caller's
      // initialValues didn't set — most load-bearing for hidden fields
      // (e.g. an enum the UI no longer asks about), which would otherwise
      // submit as undefined and fail required/enum validation server-side.
      let seeded = initialValues;
      for (const f of fields) {
        if (f.defaultValue !== undefined && seeded[f.name] === undefined) {
          seeded = { ...seeded, [f.name]: f.defaultValue };
        }
      }
      setValues(applyComputedFields(seeded));
      setErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialValues]);

  const handleChange = useCallback(
    (name: string, value: string | number | boolean) => {
      const merged = { ...valuesRef.current, [name]: value };
      const suggested = onFieldChange?.(name, value, merged);
      const next = applyComputedFields(suggested ? { ...merged, ...suggested } : merged);
      valuesRef.current = next;
      setValues(next);
      setErrors((prev) => ({ ...prev, [name]: '' }));
    },
    [applyComputedFields, onFieldChange]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    // Basic required-field validation (Zod validation happens in the API)
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.showIf && !f.showIf(values)) continue;
      const isRequired = f.required || Boolean(f.requiredIf?.(values));
      if (isRequired) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-main)' }}
        >
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
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
          {fields
            .filter((f) => !f.hidden && (!f.showIf || f.showIf(values)))
            .map((f) => (
              <Field
                key={f.name}
                def={f.requiredIf ? { ...f, required: f.required || f.requiredIf(values) } : f}
                value={values[f.name]}
                error={errors[f.name]}
                onChange={(v) => handleChange(f.name, v)}
              />
            ))}

          {children}

          {submitError && (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
            >
              {submitError}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="form-btn-cancel cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="form-btn-save cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
