'use client';

import SearchableSelect from './SearchableSelect';

export type FieldType = 'text' | 'number' | 'email' | 'password' | 'date' | 'select' | 'checkbox' | 'textarea' | 'file';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  min?: number | string; // string for date-type fields, e.g. '2026-08-30'
  max?: number | string;
  maxLength?: number;
  step?: string;
  defaultValue?: string | number | boolean;
  helpText?: string;
  disabled?: boolean;
  /** When set, FormModal derives this field's value from the rest of the
   * form on every change (e.g. an auto-generated code) and renders it
   * read-only regardless of `disabled`. */
  compute?: (values: Record<string, string | number | boolean | undefined>) => string | number;
  /** When set, FormModal hides this field unless it returns true for the
   * form's current values (e.g. a percentage that only applies to one tier). */
  showIf?: (values: Record<string, string | number | boolean | undefined>) => boolean;
  /** When set, FormModal treats this field as required (validation + asterisk)
   * whenever it returns true for the form's current values, in addition to
   * the static `required` flag. */
  requiredIf?: (values: Record<string, string | number | boolean | undefined>) => boolean;
  /** When true, FormModal never renders this field at all (still computes
   * and submits its value via `compute`) — for fields fully derived from
   * the rest of the form with nothing for the user to see or edit. */
  hidden?: boolean;
}

interface FieldProps {
  def: FieldDef;
  value: string | number | boolean | undefined;
  error?: string;
  onChange: (value: string | number | boolean) => void;
}

export default function Field({ def, value, error, onChange }: FieldProps) {
  // .form-control is the design-system input (globals.css); the error ring is
  // the only thing we still set per-field.
  const inputClass = `form-control ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : ''}`;
  const baseStyle = error
    ? { boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-danger) 22%, transparent)' }
    : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label className="form-label mb-0">
        {def.label}
        {def.required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
      </label>

      {def.type === 'checkbox' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {def.helpText ?? 'Yes'}
          </span>
        </label>
      ) : def.type === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          required={def.required}
          disabled={def.disabled}
          autoComplete="off"
          className={inputClass}
          style={baseStyle}
          rows={3}
        />
      ) : def.type === 'select' ? (
        <SearchableSelect
          value={value as string | number | undefined}
          options={def.options ?? []}
          onChange={(v) => onChange(v === '' ? '' : v)}
          disabled={def.disabled}
          error={Boolean(error)}
        />
      ) : (
        <input
          type={def.type}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) =>
            onChange(
              def.type === 'number'
                ? e.target.value === ''
                  ? ''
                  : Number(e.target.value)
                : e.target.value
            )
          }
          placeholder={def.placeholder}
          required={def.required}
          disabled={def.disabled || Boolean(def.compute)}
          autoComplete="off"
          min={def.min}
          max={def.max}
          maxLength={def.maxLength}
          step={def.step}
          className={inputClass}
          style={baseStyle}
        />
      )}

      {def.helpText && def.type !== 'checkbox' && (
        <span className="form-hint mt-0">
          {def.helpText}
        </span>
      )}
      {error && <span className="form-error mt-0">{error}</span>}
    </div>
  );
}
