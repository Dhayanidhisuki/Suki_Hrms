'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui';

interface LineItemInput {
  materialDescription: string;
  itemCode: string;
  quantity: number | '';
  unit: string;
  packageCount: number | '';
  returnable: boolean;
  remarks: string;
}

interface GNRFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  initialValues?: Record<string, unknown>;
  title?: string;
  submitLabel?: string;
}

const MOVEMENT_TYPES = [
  { label: 'Material Inward', value: 'MATERIAL_INWARD' },
  { label: 'Material Outward', value: 'MATERIAL_OUTWARD' },
  { label: 'Returnable', value: 'RETURNABLE' },
  { label: 'Non Returnable', value: 'NON_RETURNABLE' },
  { label: 'Service/Repair', value: 'SERVICE_REPAIR' },
];

const COUNTERPARTY_TYPES = [
  { label: 'Supplier', value: 'SUPPLIER' },
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Transporter', value: 'TRANSPORTER' },
];

export default function GNRFormModal({ isOpen, onClose, onSubmit, initialValues, title = 'GNR', submitLabel = 'Save' }: GNRFormModalProps) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ?? {});
    setErrors({});
  }, [isOpen, initialValues]);

  const handleChange = (name: string, v: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const lineItems: LineItemInput[] = (values.lineItems as LineItemInput[])?.length ? (values.lineItems as LineItemInput[]) : [{ materialDescription: '', itemCode: '', quantity: '', unit: '', packageCount: '', returnable: false, remarks: '' }];

  const setLineItem = (idx: number, field: keyof LineItemInput, v: string | number | boolean) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: v };
    setValues((prev) => ({ ...prev, lineItems: updated }));
  };

  const addLine = () => {
    setValues((prev) => ({ ...prev, lineItems: [...lineItems, { materialDescription: '', itemCode: '', quantity: '', unit: '', packageCount: '', returnable: false, remarks: '' }] }));
  };

  const removeLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    const updated = lineItems.filter((_, i) => i !== idx);
    setValues((prev) => ({ ...prev, lineItems: updated }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!values.dcNo) errs.dcNo = 'DC number is required';
    if (!values.movementType) errs.movementType = 'Movement type is required';
    if (!lineItems.length) errs.lineItems = 'At least one line item is required';
    lineItems.forEach((item, i) => {
      if (!item.materialDescription) errs[`lineItems.${i}.materialDescription`] = 'Description is required';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const baseStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };
  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
  const labelClass = 'block text-sm font-medium mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button onClick={onClose} className="text-lg hover:opacity-70" style={{ color: 'var(--foreground-muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>DC No *</label>
              <input type="text" value={(values.dcNo as string) ?? ''} onChange={(e) => handleChange('dcNo', e.target.value)} className={inputClass} style={baseStyle} />
              {errors.dcNo && <span className="text-xs text-red-500">{errors.dcNo}</span>}
            </div>
            <div>
              <label className={labelClass}>DC Date</label>
              <input type="date" value={(values.dcDate as string) ?? ''} onChange={(e) => handleChange('dcDate', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Movement Type *</label>
              <select value={(values.movementType as string) ?? ''} onChange={(e) => handleChange('movementType', e.target.value)} className={inputClass} style={baseStyle}>
                <option value="">—</option>
                {MOVEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.movementType && <span className="text-xs text-red-500">{errors.movementType}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Counterparty Type</label>
              <select value={(values.counterpartyType as string) ?? ''} onChange={(e) => handleChange('counterpartyType', e.target.value)} className={inputClass} style={baseStyle}>
                <option value="">—</option>
                {COUNTERPARTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Counterparty / Party Name</label>
              <input type="text" value={(values.counterpartyName as string) ?? ''} onChange={(e) => handleChange('counterpartyName', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Transporter Name</label>
              <input type="text" value={(values.transporterName as string) ?? ''} onChange={(e) => handleChange('transporterName', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Source Location</label>
              <input type="text" value={(values.sourceLocation as string) ?? ''} onChange={(e) => handleChange('sourceLocation', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Destination Location</label>
              <input type="text" value={(values.destinationLocation as string) ?? ''} onChange={(e) => handleChange('destinationLocation', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Contact Mobile</label>
              <input type="tel" inputMode="numeric" maxLength={10} value={(values.contactMobile as string) ?? ''} onChange={(e) => handleChange('contactMobile', e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} style={baseStyle} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>PO Ref</label>
              <input type="text" value={(values.purchaseOrderRef as string) ?? ''} onChange={(e) => handleChange('purchaseOrderRef', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>WO Ref</label>
              <input type="text" value={(values.workOrderRef as string) ?? ''} onChange={(e) => handleChange('workOrderRef', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Authorization Ref</label>
              <input type="text" value={(values.authorizationRef as string) ?? ''} onChange={(e) => handleChange('authorizationRef', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Vehicle Number</label>
              <input type="text" value={(values.vehicleNumber as string) ?? ''} onChange={(e) => handleChange('vehicleNumber', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Vehicle Type</label>
              <input type="text" value={(values.vehicleType as string) ?? ''} onChange={(e) => handleChange('vehicleType', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Driver Name</label>
              <input type="text" value={(values.driverName as string) ?? ''} onChange={(e) => handleChange('driverName', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>Driver Mobile</label>
              <input type="tel" inputMode="numeric" maxLength={10} value={(values.driverMobile as string) ?? ''} onChange={(e) => handleChange('driverMobile', e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} style={baseStyle} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Line Items</label>
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="col-span-3"><input type="text" placeholder="Material description *" value={item.materialDescription} onChange={(e) => setLineItem(idx, 'materialDescription', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={baseStyle} /></div>
                  <div className="col-span-2"><input type="text" placeholder="Item code" value={item.itemCode} onChange={(e) => setLineItem(idx, 'itemCode', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={baseStyle} /></div>
                  <div className="col-span-2"><input type="number" min={0} step="0.0001" placeholder="Qty" value={item.quantity} onChange={(e) => setLineItem(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded border px-2 py-1.5 text-sm" style={baseStyle} /></div>
                  <div className="col-span-1"><input type="text" placeholder="Unit" value={item.unit} onChange={(e) => setLineItem(idx, 'unit', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" style={baseStyle} /></div>
                  <div className="col-span-1"><input type="number" min={0} placeholder="Pkg" value={item.packageCount} onChange={(e) => setLineItem(idx, 'packageCount', e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded border px-2 py-1.5 text-sm" style={baseStyle} /></div>
                  <div className="col-span-2 flex items-center gap-2"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.returnable} onChange={(e) => setLineItem(idx, 'returnable', e.target.checked)} className="accent-[var(--accent)]" /> Returnable</label></div>
                  <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeLine(idx)} className="text-xs" style={{ color: 'var(--danger)' }}>Remove</button></div>
                  {errors[`lineItems.${idx}.materialDescription`] && <div className="col-span-12 text-xs text-red-500">Description is required</div>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>+ Add Line</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Gate</label>
              <input type="text" value={(values.gateId as string) ?? ''} onChange={(e) => handleChange('gateId', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
            <div>
              <label className={labelClass}>DC Document URL</label>
              <input type="text" value={(values.dcDocumentUrl as string) ?? ''} onChange={(e) => handleChange('dcDocumentUrl', e.target.value)} className={inputClass} style={baseStyle} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Remarks</label>
            <textarea value={(values.remarks as string) ?? ''} onChange={(e) => handleChange('remarks', e.target.value)} rows={2} className={inputClass} style={baseStyle} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>{submitting ? 'Saving...' : submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
