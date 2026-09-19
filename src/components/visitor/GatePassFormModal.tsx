'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui';
import { fetchEmployeeRefs, toReportingManagerOptions, type EmployeeRef } from '@/lib/employee-form-fields';
import {
  fetchVisitorOptions,
  PASS_TYPE_OPTIONS,
  type VisitorOptions,
  type VisitorOption,
} from '@/lib/visitor-form-fields';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { type FieldOption } from '@/components/ui/Field';

interface GatePassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number | boolean>) => Promise<void>;
  initialValues?: Record<string, string | number | boolean | undefined>;
  title?: string;
  submitLabel?: string;
}

const toFieldOptions = (opts: VisitorOption[]): FieldOption[] =>
  opts.map((o) => ({ label: o.label, value: o.value }));

export default function GatePassFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  title = 'Visitor Details',
  submitLabel = 'Save',
}: GatePassFormModalProps) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<FieldOption[]>([]);
  const [options, setOptions] = useState<VisitorOptions>({
    visitor_type: [],
    visitor_purpose: [],
    visitor_food_category: [],
    visitor_food_type: [],
    visitor_gadgets: [],
  });

  // Load dropdown options + employee list when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ?? {});
    setErrors({});

    Promise.all([fetchVisitorOptions(), fetchEmployeeRefs()]).then(([opts, emps]) => {
      setOptions(opts);
      setEmployeeOptions(toReportingManagerOptions(emps));
    });
  }, [isOpen, initialValues]);

  const handleChange = (name: string, v: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!values.visitorName) errs.visitorName = 'Visitor name is required';
    if (!values.mobileNo) errs.mobileNo = 'Mobile number is required';
    else if (!/^\d{10}$/.test(String(values.mobileNo))) errs.mobileNo = 'Enter a valid 10-digit mobile number';
    if (!values.visitorTypeValue) errs.visitorTypeValue = 'Visitor type is required';
    if (!values.purposeValue) errs.purposeValue = 'Purpose is required';
    if (!values.personToMeetId) errs.personToMeetId = 'Person to meet is required';
    if (!values.visitDate) errs.visitDate = 'Visit date is required';
    if (!values.validFrom) errs.validFrom = 'Valid from is required';
    if (!values.validTo) errs.validTo = 'Valid to is required';
    if (values.qrValidHours === undefined || values.qrValidHours === '') errs.qrValidHours = 'QR validity is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = { ...values };
      const hours = typeof payload.qrValidHours === 'number' ? payload.qrValidHours : Number(payload.qrValidHours);
      payload.qrValidMinutes = Math.round(hours * 60);
      delete payload.qrValidHours;
      await onSubmit(payload as Record<string, string | number | boolean>);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const baseInputClass = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
  const inputClass = `${baseInputClass} w-full`;
  const baseStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const labelClass = 'text-sm font-medium';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button onClick={onClose} className="text-lg hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left column — visitor details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Visitor</h3>

              <div>
                <label className={labelClass}>Status</label>
                <input
                  readOnly
                  value={values.status ? String(values.status) : 'DRAFT'}
                  className={inputClass}
                  style={{ ...baseStyle, backgroundColor: 'var(--surface-muted)', opacity: 0.7 }}
                />
              </div>

              <div>
                <label className={labelClass}>Type *</label>
                <SearchableSelect
                  value={values.passType as string | undefined}
                  options={PASS_TYPE_OPTIONS}
                  onChange={(v) => handleChange('passType', v)}
                  placeholder="—"
                />
              </div>

              <div>
                <label className={labelClass}>Mobile No *</label>
                <div className="flex gap-2">
                  <select
                    value={values.mobilePrefix as string | undefined}
                    onChange={(e) => handleChange('mobilePrefix', e.target.value)}
                    className={`${baseInputClass} w-24 shrink-0`}
                    style={baseStyle}
                  >
                    <option value="+91">+91 IN</option>
                    <option value="+1">+1 US</option>
                    <option value="+44">+44 UK</option>
                    <option value="+61">+61 AU</option>
                    <option value="+65">+65 SG</option>
                    <option value="+971">+971 AE</option>
                    <option value="+966">+966 SA</option>
                    <option value="+977">+977 NP</option>
                    <option value="+880">+880 BD</option>
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={values.mobileNo as string | undefined}
                    onChange={(e) => handleChange('mobileNo', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`${baseInputClass} flex-1 min-w-0`}
                    style={baseStyle}
                    placeholder="10-digit mobile number"
                  />
                </div>
                {errors.mobileNo && <span className="text-xs text-red-500">{errors.mobileNo}</span>}
              </div>

              <div>
                <label className={labelClass}>Visitor Name *</label>
                <input
                  type="text"
                  value={values.visitorName as string | undefined}
                  onChange={(e) => handleChange('visitorName', e.target.value)}
                  className={inputClass}
                  style={baseStyle}
                />
                {errors.visitorName && <span className="text-xs text-red-500">{errors.visitorName}</span>}
              </div>

              <div>
                <label className={labelClass}>Visitor Type *</label>
                <SearchableSelect
                  value={values.visitorTypeValue as string | undefined}
                  options={toFieldOptions(options.visitor_type)}
                  onChange={(v) => handleChange('visitorTypeValue', v)}
                  placeholder="—"
                />
                {errors.visitorTypeValue && <span className="text-xs text-red-500">{errors.visitorTypeValue}</span>}
              </div>

              <div>
                <label className={labelClass}>Party Name</label>
                <input
                  type="text"
                  value={values.partyName as string | undefined}
                  onChange={(e) => handleChange('partyName', e.target.value)}
                  className={inputClass}
                  style={baseStyle}
                />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={values.email as string | undefined}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClass}
                  style={baseStyle}
                />
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <textarea
                  value={values.address as string | undefined}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={2}
                  className={inputClass}
                  style={baseStyle}
                />
              </div>
            </div>

            {/* Right column — host / schedule / logistics */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Visit & Host</h3>

              <div>
                <label className={labelClass}>Gate Pass Date *</label>
                <input
                  type="date"
                  value={values.visitDate as string | undefined}
                  onChange={(e) => handleChange('visitDate', e.target.value)}
                  className={inputClass}
                  style={baseStyle}
                />
                {errors.visitDate && <span className="text-xs text-red-500">{errors.visitDate}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Valid From *</label>
                  <input
                    type="datetime-local"
                    value={values.validFrom as string | undefined}
                    onChange={(e) => handleChange('validFrom', e.target.value)}
                    className={inputClass}
                    style={baseStyle}
                  />
                  {errors.validFrom && <span className="text-xs text-red-500">{errors.validFrom}</span>}
                </div>
                <div>
                  <label className={labelClass}>Valid To *</label>
                  <input
                    type="datetime-local"
                    value={values.validTo as string | undefined}
                    onChange={(e) => handleChange('validTo', e.target.value)}
                    className={inputClass}
                    style={baseStyle}
                  />
                  {errors.validTo && <span className="text-xs text-red-500">{errors.validTo}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Planned In Time</label>
                  <input
                    type="time"
                    value={values.plannedInTime as string | undefined}
                    onChange={(e) => handleChange('plannedInTime', e.target.value)}
                    className={inputClass}
                    style={baseStyle}
                  />
                </div>
                <div>
                  <label className={labelClass}>Planned Out Time</label>
                  <input
                    type="time"
                    value={values.plannedOutTime as string | undefined}
                    onChange={(e) => handleChange('plannedOutTime', e.target.value)}
                    className={inputClass}
                    style={baseStyle}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Person To Meet *</label>
                <SearchableSelect
                  value={values.personToMeetId as string | number | undefined}
                  options={employeeOptions}
                  onChange={(v) => handleChange('personToMeetId', v)}
                  placeholder="Search employee..."
                />
                {errors.personToMeetId && <span className="text-xs text-red-500">{errors.personToMeetId}</span>}
              </div>

              <div>
                <label className={labelClass}>No of Persons *</label>
                <input
                  type="number"
                  min={1}
                  value={(values.noOfPersons as number | undefined) ?? 1}
                  onChange={(e) => handleChange('noOfPersons', e.target.value === '' ? 1 : Number(e.target.value))}
                  className={inputClass}
                  style={baseStyle}
                />
              </div>

              <div>
                <label className={labelClass}>Purpose *</label>
                <SearchableSelect
                  value={values.purposeValue as string | undefined}
                  options={toFieldOptions(options.visitor_purpose)}
                  onChange={(v) => handleChange('purposeValue', v)}
                  placeholder="—"
                />
                {errors.purposeValue && <span className="text-xs text-red-500">{errors.purposeValue}</span>}
              </div>

              <div>
                <label className={labelClass}>Food Required *</label>
                <SearchableSelect
                  value={values.foodRequired === true ? 'YES' : values.foodRequired === false ? 'NO' : undefined}
                  options={[{ label: 'YES', value: 'YES' }, { label: 'NO', value: 'NO' }]}
                  onChange={(v) => handleChange('foodRequired', v === 'YES')}
                  placeholder="—"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Food Category</label>
                  <SearchableSelect
                    value={values.foodCategory as string | undefined}
                    options={toFieldOptions(options.visitor_food_category)}
                    onChange={(v) => handleChange('foodCategory', v)}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className={labelClass}>Food Type</label>
                  <SearchableSelect
                    value={values.foodType as string | undefined}
                    options={toFieldOptions(options.visitor_food_type)}
                    onChange={(v) => handleChange('foodType', v)}
                    placeholder="—"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Gadgets</label>
                <SearchableSelect
                  value={values.gadgets as string | undefined}
                  options={toFieldOptions(options.visitor_gadgets)}
                  onChange={(v) => handleChange('gadgets', v)}
                  placeholder="—"
                />
              </div>

              <div>
                <label className={labelClass}>QR Validity (hours) *</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={(values.qrValidHours as string | number | undefined) ?? ''}
                  onChange={(e) => handleChange('qrValidHours', e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                  style={baseStyle}
                  placeholder="24"
                />
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Default 24 hrs. How long the QR token stays valid.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
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
