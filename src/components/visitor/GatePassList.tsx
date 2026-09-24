'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui';
import DataTable, { type Column, type Pagination } from '@/components/ui/DataTable';
import { fetchEmployeeRefs, toReportingManagerOptions } from '@/lib/employee-form-fields';
import { formatStatus, statusTone, STATUS_OPTIONS } from '@/lib/visitor-form-fields';
import GatePassFormModal from './GatePassFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Pass {
  id: number;
  gatePassNo: string;
  passType: string;
  status: string;
  visitorName: string;
  mobileNo: string;
  visitorTypeValue: string | null;
  partyName: string | null;
  purposeValue: string | null;
  email: string | null;
  address: string | null;
  visitDate: string;
  validFrom: string;
  validTo: string;
  plannedInTime: string | null;
  plannedOutTime: string | null;
  noOfPersons: number;
  foodRequired: boolean;
  foodCategory: string | null;
  foodType: string | null;
  gadgets: string | null;
  qrValidMinutes: number;
  checkInBy: number | null;
  checkInTime: string | null;
  checkOutBy: number | null;
  checkOutTime: string | null;
  createdAt: string;
  updatedAt: string;
  personToMeet: { id: number; firstName: string; lastName: string; employeeCode: string; oldEmployeeCode: string | null } | null;
}

interface GatePassListProps {
  title: string;
  subtitle?: string;
  defaultStatus?: string;
  primaryAction?: 'check-in' | 'check-out' | 'none';
  readOnly?: boolean;
  showAdd?: boolean;
  showExport?: boolean;
  headerAction?: React.ReactNode;
}

const PAGE_SIZE = 15;

const Icon = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
  ),
  File: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
  ),
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex min-w-[150px] items-center rounded-lg border text-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer select-bare appearance-none bg-transparent py-2 pl-3 pr-8 focus:outline-none" style={{ color: value ? 'var(--foreground)' : 'var(--foreground-muted)' }}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2.5" style={{ color: 'var(--foreground-muted)' }}><Icon.ChevronDown /></span>
    </label>
  );
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GatePassList({ title, subtitle, defaultStatus = '', primaryAction = 'none', readOnly = false, showAdd = true, showExport = false, headerAction }: GatePassListProps) {
  const toast = useToast();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [passType, setPassType] = useState('');
  const [personToMeetId, setPersonToMeetId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employees, setEmployees] = useState<{ label: string; value: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetchEmployeeRefs().then((list) => {
      setEmployees(toReportingManagerOptions(list).map((e) => ({ label: e.label, value: String(e.value) })));
    });
  }, []);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('page', String(pagination.page));
    p.set('limit', String(PAGE_SIZE));
    if (search) p.set('search', search);
    if (statusFilter) p.set('status', statusFilter);
    if (passType) p.set('passType', passType);
    if (personToMeetId) p.set('personToMeetId', personToMeetId);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p;
  }, [pagination.page, search, statusFilter, passType, personToMeetId, dateFrom, dateTo]);

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visitor/gate-passes?${filterParams()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setPasses(json.data);
      setPagination(json.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filterParams, toast]);

  useEffect(() => { fetchPasses(); }, [fetchPasses]);

  const withReset = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleAdd = () => {
    setEditingId(null);
    setInitialValues({
      status: 'DRAFT',
      passType: 'GATE_PASS',
      mobilePrefix: '+91',
      noOfPersons: 1,
      qrValidHours: 24,
    });
    setModalOpen(true);
  };

  const handleEdit = (row: Pass) => {
    setEditingId(row.id);
    setInitialValues({
      passType: row.passType,
      status: row.status,
      visitorName: row.visitorName,
      mobileNo: row.mobileNo,
      visitorTypeValue: row.visitorTypeValue ?? undefined,
      partyName: row.partyName ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      visitDate: toDateInput(row.visitDate),
      validFrom: toDateTimeLocal(row.validFrom),
      validTo: toDateTimeLocal(row.validTo),
      plannedInTime: row.plannedInTime ?? '',
      plannedOutTime: row.plannedOutTime ?? '',
      personToMeetId: row.personToMeet?.id,
      noOfPersons: row.noOfPersons,
      purposeValue: row.purposeValue ?? undefined,
      foodRequired: row.foodRequired ? 'YES' : 'NO',
      foodCategory: row.foodCategory ?? '',
      foodType: row.foodType ?? '',
      gadgets: row.gadgets ?? '',
      qrValidHours: row.qrValidMinutes / 60,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? `/api/visitor/gate-passes/${editingId}` : '/api/visitor/gate-passes';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchPasses();
  };

  const performAction = async (id: number, action: 'submit' | 'approve' | 'reject' | 'check-in' | 'check-out' | 'cancel', body?: Record<string, unknown>) => {
    const res = await fetch(`/api/visitor/gate-passes/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Action failed');
      return;
    }
    fetchPasses();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/visitor/gate-passes/${deleteId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    setDeleteId(null);
    fetchPasses();
  };

  const exportCSV = () => {
    const headers = ['gatePassNo', 'passType', 'status', 'visitorName', 'mobileNo', 'visitorTypeValue', 'partyName', 'purposeValue', 'visitDate', 'validFrom', 'validTo', 'checkInTime', 'checkOutTime'];
    const rows = passes.map((p) => headers.map((h) => `"${String((p as unknown as Record<string, unknown>)[h] ?? '').replace(/"/g, "'")}"`).join(','));
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

  const columns: Column<Pass>[] = ([
    { key: 'gatePassNo', label: 'Gate Pass No', className: 'font-medium' },
    { key: 'passType', label: 'Type', render: (row) => row.passType === 'GATE_PASS' ? 'GATE PASS' : 'WORK PERMIT' },
    { key: 'visitDate', label: 'Pass Date', render: (row) => row.visitDate ? new Date(row.visitDate).toLocaleDateString('en-IN') : '—' },
    { key: 'visitorName', label: 'Visitor' },
    { key: 'mobileNo', label: 'Mobile' },
    { key: 'visitorTypeValue', label: 'Visitor Type' },
    { key: 'partyName', label: 'Party' },
    { key: 'noOfPersons', label: 'No. of Persons' },
    {
      key: 'personToMeet',
      label: 'Person To Meet',
      render: (row) => row.personToMeet ? `${row.personToMeet.firstName} ${row.personToMeet.lastName}` : '—',
    },
    { key: 'purposeValue', label: 'Purpose' },
    { key: 'plannedInTime', label: 'In Time' },
    { key: 'plannedOutTime', label: 'Out Time' },
    { key: 'checkInBy', label: 'Check-In By', render: () => '—' },
    { key: 'checkInTime', label: 'Check-In Time', render: (row) => row.checkInTime ? new Date(row.checkInTime).toLocaleString('en-IN') : '—' },
    { key: 'checkOutBy', label: 'Check-Out By', render: () => '—' },
    { key: 'checkOutTime', label: 'Check-Out Time', render: (row) => row.checkOutTime ? new Date(row.checkOutTime).toLocaleString('en-IN') : '—' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const tone = statusTone(row.status);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {formatStatus(row.status)}
          </span>
        );
      },
    },
    { key: 'createdAt', label: 'Created Date', render: (row) => new Date(row.createdAt).toLocaleDateString('en-IN') },
    { key: 'updatedAt', label: 'Updated Date', render: (row) => new Date(row.updatedAt).toLocaleDateString('en-IN') },
  ] as Column<Pass>[]).map((col) => ({ ...col, className: `${col.className ?? ''} whitespace-nowrap`.trim() }));

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
        data={passes}
        pagination={pagination}
        loading={loading}
        searchValue={search}
        searchPlaceholder="Search by name, mobile, pass no..."
        onSearchChange={withReset(setSearch)}
        filters={
          <>
            <FilterSelect label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={withReset(setStatusFilter)} />
            <FilterSelect label="Type" value={passType} options={[{ label: 'GATE PASS', value: 'GATE_PASS' }, { label: 'WORK PERMIT', value: 'WORK_PERMIT' }]} onChange={withReset(setPassType)} />
            <FilterSelect label="Person To Meet" value={personToMeetId} options={employees} onChange={withReset(setPersonToMeetId)} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => withReset(setDateFrom)(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              title="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => withReset(setDateTo)(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              title="To date"
            />
          </>
        }
        onPageChange={(p) => setPagination((pg) => ({ ...pg, page: p }))}
        renderRowActions={readOnly ? undefined : (row) => (
          <span className="inline-flex items-center gap-1">
            {['APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(row.status) && (
              <>
                <a
                  href={`/api/visitor/gate-passes/${row.id}/visitor-pass.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Visitor Pass PDF"
                  className="rounded-md p-1.5 transition hover:opacity-70"
                  style={{ color: 'var(--accent)' }}
                >
                  <Icon.File />
                </a>
                <a
                  href={`/api/visitor/gate-passes/${row.id}/gate-pass.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Gate Pass PDF"
                  className="rounded-md p-1.5 transition hover:opacity-70"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <Icon.File />
                </a>
              </>
            )}
            {row.status === 'DRAFT' && (
              <>
                <button onClick={() => handleEdit(row)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Edit</button>
                <button onClick={() => performAction(row.id, 'submit')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>Submit</button>
                <button onClick={() => setDeleteId(row.id)} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>Delete</button>
              </>
            )}
            {row.status === 'PENDING_APPROVAL' && (
              <>
                <button onClick={() => performAction(row.id, 'approve')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>Approve</button>
                <button onClick={() => performAction(row.id, 'reject', { reason: 'Rejected' })} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>Reject</button>
              </>
            )}
            {row.status === 'APPROVED' && (
              <>
                <button onClick={() => performAction(row.id, 'check-in')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>Check In</button>
                <button onClick={() => performAction(row.id, 'cancel')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>Cancel</button>
              </>
            )}
            {row.status === 'CHECKED_IN' && (
              <button onClick={() => performAction(row.id, 'check-out')} className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>Check Out</button>
            )}
          </span>
        )}
        emptyMessage="No gate passes found."
      />

      <GatePassFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initialValues={initialValues}
        title={editingId ? 'Edit Visitor Details' : 'Add Visitor Details'}
        submitLabel={editingId ? 'Update' : 'Save'}
      />

      <ConfirmDialog
        title="Delete Gate Pass"
        message="Are you sure you want to delete this gate pass?"
        isOpen={deleteId !== null}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
