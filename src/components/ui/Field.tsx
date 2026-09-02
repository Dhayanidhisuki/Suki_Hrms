'use client';

import SearchableSelect from './SearchableSelect';

export type FieldType = 'text' | 'number' | 'email' | 'password' | 'date' | 'select' | 'checkbox' | 'textarea';

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
}

interface FieldProps {
  def: FieldDef;
  value: string | number | boolean | undefined;
  error?: string;
  onChange: (value: string | number | boolean) => void;
}

export default function Field({ def, value, error, onChange }: FieldProps) {
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-2 transition ${
    error
      ? 'border-red-400 focus:ring-red-400'
      : 'focus:ring-[var(--accent)]'
  }`;
  const baseStyle = {
    backgroundColor: def.disabled ? 'var(--surface-muted)' : 'var(--surface)',
    color: 'var(--foreground)',
    borderColor: error ? '#f87171' : 'var(--border)',
    opacity: def.disabled ? 0.7 : 1,
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {def.label}
        {def.required && <span className="text-red-500 ml-0.5">*</span>}
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
          disabled={def.disabled}
          min={def.min}
          max={def.max}
          maxLength={def.maxLength}
          step={def.step}
          className={inputClass}
          style={baseStyle}
        />
      )}

      {def.helpText && def.type !== 'checkbox' && (
        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          {def.helpText}
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
