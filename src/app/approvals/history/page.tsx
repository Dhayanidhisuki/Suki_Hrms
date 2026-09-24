/**
 * Approval History — the HR/admin audit trail of every two-stage employee
 * request across modules, with both stages' actor and timestamp on one row.
 *
 * HR-level and company-wide, backed by /api/workforce/approval-history
 * (workforce.leave.view). An employee's own trail lives on their ESS pages;
 * an approver's own decisions live in "My Approval History" on each queue.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, useToast, type Column } from '@/components/ui';
import { handleExport } from '@/lib/export-utils';

const MODULES = [
  { value: 'leave', label: 'Leave' },
  { value: 'mispunch', label: 'Mis-Punch' },
  { value: 'permission', label: 'Permission' },
  { value: 'on-duty', label: 'On-Duty' },
  { value: 'wfh', label: 'WFH' },
];

const STATUSES = ['pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled'];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
};
const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

interface Row {
  module: string;
  moduleLabel: string;
  id: number;
  employeeCode: string;
  employeeName: string;
  detail: string;
  period: string;
  reason: string | null;
  status: string;
  appliedAt: string;
  managerActionBy: string | null;
  managerActionAt: string | null;
  managerRejectionReason: string | null;
  hrActionBy: string | null;
  hrActionAt: string | null;
  hrRejectionReason: string | null;
}

const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function ApprovalHistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [modules, setModules] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      for (const m of modules) qs.append('module', m);
      if (status) qs.set('status', status);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/workforce/approval-history?${qs.toString()}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const json: { data: Row[]; total: number; truncated: boolean } = await res.json();
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setTruncated(!!json.truncated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [modules, status, from, to, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const toggleModule = (m: string) =>
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const columns: Column<Row>[] = [
    { key: 'moduleLabel', label: 'Type', render: (r) => r.moduleLabel },
    { key: 'employee', label: 'Employee', render: (r) => r.employeeCode ? `${r.employeeCode} — ${r.employeeName}` : r.employeeName },
    { key: 'period', label: 'Period', render: (r) => r.period },
    { key: 'detail', label: 'Detail', render: (r) => r.detail },
    { key: 'appliedAt', label: 'Applied', render: (r) => stamp(r.appliedAt) },
    {
      key: 'manager',
      label: 'Manager Stage',
      render: (r) =>
        r.managerActionAt ? (
          <div className="text-xs">
            <div style={{ color: 'var(--foreground)' }}>{r.managerActionBy ?? '—'}</div>
            <div style={{ color: 'var(--foreground-muted)' }}>{stamp(r.managerActionAt)}</div>
            {r.managerRejectionReason && <div style={{ color: '#991b1b' }}>{r.managerRejectionReason}</div>}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Not actioned</span>
        ),
    },
    {
      key: 'hr',
      label: 'HR Stage',
      render: (r) =>
        r.hrActionAt ? (
          <div className="text-xs">
            <div style={{ color: 'var(--foreground)' }}>{r.hrActionBy ?? '—'}</div>
            <div style={{ color: 'var(--foreground-muted)' }}>{stamp(r.hrActionAt)}</div>
            {r.hrRejectionReason && <div style={{ color: '#991b1b' }}>{r.hrRejectionReason}</div>}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Not actioned</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f1f5f9', fg: '#475569' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        );
      },
    },
  ];

  const exportRows = () =>
    rows.map((r) => ({
      Type: r.moduleLabel,
      'Employee Code': r.employeeCode,
      Employee: r.employeeName,
      Period: r.period,
      Detail: r.detail,
      Reason: r.reason ?? '',
      Applied: stamp(r.appliedAt),
      'Manager Actioned By': r.managerActionBy ?? '',
      'Manager Actioned At': stamp(r.managerActionAt),
      'Manager Rejection Reason': r.managerRejectionReason ?? '',
      'HR Actioned By': r.hrActionBy ?? '',
      'HR Actioned At': stamp(r.hrActionAt),
      'HR Rejection Reason': r.hrRejectionReason ?? '',
      Status: STATUS_LABEL[r.status] ?? r.status,
    }));

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Approval History</h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Every employee request across modules, with who actioned each stage and when.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['csv', 'excel', 'pdf'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport({ filename: 'approval-history', data: exportRows(), format: fmt, title: 'Approval History' })}
              disabled={rows.length === 0}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>Type</span>
          {MODULES.map((m) => {
            const on = modules.includes(m.value);
            return (
              <button
                key={m.value}
                onClick={() => toggleModule(m.value)}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  borderColor: on ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: on ? 'rgba(34,181,115,0.12)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                {m.label}
              </button>
            );
          })}
          {modules.length > 0 && (
            <button onClick={() => setModules([])} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              All types
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
          <button
            onClick={() => { setModules([]); setStatus(''); setFrom(''); setTo(''); }}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Clear filters
          </button>
        </div>
      </div>

      {!loading && (
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Showing {rows.length} of {total}
          {truncated && ' — narrow the filters to see the rest'}
        </p>
      )}

      {/* Ids are only unique per module — leave #9 and mis-punch #9 are
          different records — so the key has to include the module. */}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        rowKey={(r) => `${r.module}-${r.id}`}
        emptyMessage="No approval records match these filters."
      />
    </div>
  );
}
