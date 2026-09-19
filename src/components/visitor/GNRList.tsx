'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';
import DataTable, { type Column, type Pagination } from '@/components/ui/DataTable';
import { formatGnrStatus, gnrStatusTone } from '@/lib/gnr-helpers';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import GNRFormModal from './GNRFormModal';

interface LineItem {
  id?: number;
  materialDescription: string;
  itemCode: string;
  quantity: number | '';
  unit: string;
  packageCount: number | '';
  returnable: boolean;
  remarks: string;
}

interface GNR {
  id: number;
  gnrNo: string;
  dcNo: string;
  dcDate: string | null;
  movementType: string;
  status: string;
  counterpartyName: string | null;
  vehicleNumber: string | null;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
}

interface GNRListProps {
  title: string;
  subtitle?: string;
  defaultMovementType?: string;
  defaultStatus?: string;
  primaryAction?: 'inward' | 'outward' | 'none';
  readOnly?: boolean;
  showAdd?: boolean;
  showExport?: boolean;
  headerAction?: React.ReactNode;
}

const PAGE_SIZE = 15;

const MOVEMENT_TYPES = [
  { label: 'Material Inward', value: 'MATERIAL_INWARD' },
  { label: 'Material Outward', value: 'MATERIAL_OUTWARD' },
  { label: 'Returnable', value: 'RETURNABLE' },
  { label: 'Non Returnable', value: 'NON_RETURNABLE' },
  { label: 'Service/Repair', value: 'SERVICE_REPAIR' },
];

const Icon = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
  ),
};

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="relative inline-flex min-w-[150px] items-center rounded-lg border text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-8 focus:outline-none" style={{ color: value ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2.5" style={{ color: 'var(--foreground-muted)' }}>▼</span>
    </label>
  );
}

const GNR_STATUS_OPTIONS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'GNR Created', value: 'GNR_CREATED' },
  { label: 'Awaiting Authorization', value: 'AWAITING_AUTHORIZATION' },
  { label: 'Authorized', value: 'AUTHORIZED' },
  { label: 'Inward Recorded', value: 'INWARD_RECORDED' },
  { label: 'Outward Recorded', value: 'OUTWARD_RECORDED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function GNRList({ title, subtitle, defaultMovementType = '', defaultStatus = '', primaryAction = 'none', readOnly = false, showAdd = true, showExport = false, headerAction }: GNRListProps) {
  const toast = useToast();
  const [gnrs, setGnrs] = useState<GNR[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState(defaultMovementType);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('page', String(pagination.page));
    p.set('limit', String(PAGE_SIZE));
    if (search) p.set('search', search);
    if (movementType) p.set('movementType', movementType);
    if (statusFilter) p.set('status', statusFilter);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p;
  }, [pagination.page, search, movementType, statusFilter, dateFrom, dateTo]);

  const fetchGnrs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visitor/gnr?${filterParams()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setGnrs(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filterParams, toast]);

  useEffect(() => { fetchGnrs(); }, [fetchGnrs]);

  const withReset = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({
      movementType: defaultMovementType || 'MATERIAL_INWARD',
      dcDate: new Date().toISOString().slice(0, 10),
      lineItems: [{ materialDescription: '', itemCode: '', quantity: '', unit: '', packageCount: '', returnable: false, remarks: '' }],
    });
    setModalOpen(true);
  };

  const handleEdit = (row: GNR) => {
    setEditingId(row.id);
    setInitialValues({
      ...row,
      dcDate: row.dcDate ? new Date(row.dcDate).toISOString().slice(0, 10) : '',
      lineItems: row.lineItems.length ? row.lineItems : [{ materialDescription: '', itemCode: '', quantity: '', unit: '', packageCount: '', returnable: false, remarks: '' }],
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const url = editingId ? `/api/visitor/gnr/${editingId}` : '/api/visitor/gnr';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchGnrs();
  };

  const performAction = async (id: number, action: 'authorize' | 'inward' | 'outward' | 'reject', body?: Record<string, unknown>) => {
    const res = await fetch(`/api/visitor/gnr/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Action failed');
      return;
    }
    fetchGnrs();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/visitor/gnr/${deleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    setDeleteId(null);
    fetchGnrs();
  };

  const exportCSV = () => {
    const headers = ['gnrNo', 'dcNo', 'dcDate', 'movementType', 'status', 'counterpartyName', 'vehicleNumber', 'lineItems'];
    const rows = gnrs.map((g) => headers.map((h) => {
      const v = h === 'lineItems' ? (g.lineItems?.length ?? 0) : (g as any)[h];
      return `"${String(v ?? '').replace(/"/g, "'")}"`;
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const columns: Column<GNR>[] = ([
    { key: 'gnrNo', label: 'GNR No', className: 'font-medium' },
    { key: 'dcNo', label: 'DC No' },
    { key: 'dcDate', label: 'DC Date', render: (row) => row.dcDate ? new Date(row.dcDate).toLocaleDateString('en-IN') : '—' },
    { key: 'movementType', label: 'Movement', render: (row) => MOVEMENT_TYPES.find((t) => t.value === row.movementType)?.label ?? row.movementType },
    { key: 'counterpartyName', label: 'Party' },
    { key: 'vehicleNumber', label: 'Vehicle' },
    { key: 'lineItems', label: 'Items', render: (row) => row.lineItems?.length ?? 0 },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const tone = gnrStatusTone(row.status);
        return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>{formatGnrStatus(row.status)}</span>;
      },
    },
    { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString('en-IN') },
  ] as Column<GNR>[]).map((col) => ({ ...col, className: `${col.className ?? ''} whitespace-nowrap`.trim() }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h1>
          {subtitle && <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {showExport && (
            <button onClick={exportCSV} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              Export CSV
            </button>
          )}
          {showAdd && !readOnly && (
            <button onClick={handleAdd} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
              <Icon.Plus /> Add
            </button>
          )}
        </div>
      </div>

      <DataTable
        variant="card"
        columns={columns}
        data={gnrs}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search GNR, DC, party, vehicle..."
        onSearchChange={withReset(setSearch)}
        filters={
          <>
            <FilterSelect label="Movement" value={movementType} options={MOVEMENT_TYPES} onChange={withReset(setMovementType)} />
            <FilterSelect label="Status" value={statusFilter} options={GNR_STATUS_OPTIONS} onChange={withReset(setStatusFilter)} />
            <input type="date" value={dateFrom} onChange={(e) => withReset(setDateFrom)(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} title="From date" />
            <input type="date" value={dateTo} onChange={(e) => withReset(setDateTo)(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }} title="To date" />
          </>
        }
        onPageChange={(p) => setPagination((pg) => ({ ...pg, page: p }))}
        renderRowActions={readOnly ? undefined : (row) => (
          <span className="inline-flex items-center gap-1">
            {row.status === 'GNR_CREATED' && primaryAction === 'inward' && ['MATERIAL_INWARD', 'RETURNABLE', 'NON_RETURNABLE', 'SERVICE_REPAIR'].includes(row.movementType) && (
              <button onClick={() => performAction(row.id, 'inward')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>Record Inward</button>
            )}
            {row.movementType === 'MATERIAL_OUTWARD' && row.status === 'GNR_CREATED' && (
              <button onClick={() => performAction(row.id, 'authorize')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>Authorize</button>
            )}
            {row.movementType === 'MATERIAL_OUTWARD' && row.status === 'AUTHORIZED' && primaryAction === 'outward' && (
              <button onClick={() => performAction(row.id, 'outward')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>Record Outward</button>
            )}
            {['GNR_CREATED', 'AWAITING_AUTHORIZATION'].includes(row.status) && (
              <button onClick={() => handleEdit(row)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Edit</button>
            )}
            {['GNR_CREATED', 'AWAITING_AUTHORIZATION', 'AUTHORIZED'].includes(row.status) && (
              <button onClick={() => performAction(row.id, 'reject', { reason: 'Rejected' })} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>Reject</button>
            )}
            {!['INWARD_RECORDED', 'OUTWARD_RECORDED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(row.status) && (
              <button onClick={() => setDeleteId(row.id)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>Delete</button>
            )}
          </span>
        )}
        emptyMessage="No GNR records found."
      />

      <GNRFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialValues={initialValues}
        title={editingId ? 'Edit GNR' : 'Create GNR'}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <ConfirmDialog
        title="Delete GNR"
        message="Are you sure you want to delete this GNR?"
        isOpen={deleteId !== null}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
