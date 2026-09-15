/**
 * Comp-off Request page — employees can request comp-off for approved
 * weekly-off/holiday work. HR/admins can see all requests and approve/reject.
 *
 * UI pass (2026-09): KPI strip, status tabs, request cards with a
 * "worked → comp-off" date pair, reject via modal. Endpoints/fields unchanged.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FormModal, PageHeader, Alert, StatusBadge, statusTone, SectionCard, Tabs, Button, EmptyState, KPICard, KPIGrid, type FieldDef } from '@/components/ui';

interface CompOffRequest {
  id: number;
  employeeId: number;
  workedDate: string;
  requestedDate: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
  employee: { id: number; employeeCode: string; firstName: string; lastName: string };
}

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

const rejectFields: FieldDef[] = [{ name: 'rejectionReason', label: 'Rejection Reason (optional)', type: 'textarea' }];

const inputCls = 'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2';
const inputStyle = { backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

const DateTile = ({ iso, label, tone }: { iso: string; label: string; tone: 'warning' | 'success' }) => {
  const d = new Date(iso);
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none" style={{ backgroundColor: `var(--${tone}-soft)`, color: `var(--${tone})` }}>
        <span className="text-[9px] font-semibold uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
        <span className="text-base font-bold tabular-nums">{d.getUTCDate()}</span>
      </div>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.toLocaleDateString(undefined, { weekday: 'long' })}</div>
      </div>
    </div>
  );
};

export default function CompOffRequestPage() {
  const [requests, setRequests] = useState<CompOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isHr, setIsHr] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ workedDate: '', requestedDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [rejectId, setRejectId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/comp-off-request');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const rows: CompOffRequest[] = json.data ?? [];
      setRequests(rows);
      // Check if we see all employees' requests (HR mode)
      setIsHr(rows.length > 0 && rows.some((r) => r.employeeId !== rows[0]?.employeeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!formData.workedDate || !formData.requestedDate) {
      alert('Please fill in both dates');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/workforce/comp-off-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Failed to submit');
        return;
      }
      setShowCreate(false);
      setFormData({ workedDate: '', requestedDate: '', reason: '' });
      setResult('Comp-off request submitted for approval');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/workforce/comp-off-request/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Failed to approve');
        return;
      }
      setResult('Comp-off approved — 1 day credited to the employee');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleReject = async (values: Record<string, string | number | boolean>) => {
    if (!rejectId) return;
    const res = await fetch(`/api/workforce/comp-off-request/${rejectId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: String(values.rejectionReason ?? '') }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Failed to reject');
    }
    setRejectId(null);
    setResult('Comp-off request rejected');
    fetchData();
  };

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }), [requests]);

  const visible = useMemo(() => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)), [requests, filter]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Time Office"
        title="Comp-off Requests"
        description="Claim a compensatory day off for approved weekly-off or holiday work. HR reviews each claim; on approval one comp-off day is credited to your leave balance."
        actions={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Request Comp-off</Button>}
      />

      <KPIGrid columns={4}>
        <KPICard label="Total Requests" value={counts.all} tone="info" />
        <KPICard label="Pending" value={counts.pending} tone={counts.pending > 0 ? 'warning' : 'success'} />
        <KPICard label="Approved" value={counts.approved} subtitle={`${counts.approved} day${counts.approved === 1 ? '' : 's'} credited`} tone="success" />
        <KPICard label="Rejected" value={counts.rejected} tone={counts.rejected > 0 ? 'danger' : 'success'} />
      </KPIGrid>

      {error && <Alert tone="danger" onDismiss={() => setError(null)}>{error}</Alert>}
      {result && <Alert tone="success" onDismiss={() => setResult(null)}>{result}</Alert>}

      <SectionCard
        title={isHr ? 'All Requests' : 'My Requests'}
        description={isHr ? 'You are seeing every employee’s request — approve or reject pending ones.' : 'Your comp-off claims and their status.'}
        count={loading ? undefined : visible.length}
        actions={
          <Tabs<Filter>
            variant="segmented"
            tabs={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'approved', label: 'Approved', count: counts.approved },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
            ]}
            active={filter}
            onChange={setFilter}
          />
        }
        flush
      >
        {loading ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No comp-off requests yet' : `No ${filter} requests`}
            description={filter === 'all' ? 'Work on a configured weekly off or declared holiday, get the OT approved, then claim comp-off here.' : undefined}
            action={filter === 'all' ? <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Request Comp-off</Button> : undefined}
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {visible.map((req) => (
              <li key={req.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--border)' }}>
                <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-6">
                  <div className="w-52 min-w-0 leading-tight">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{req.employee.firstName} {req.employee.lastName}</div>
                    <div className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{req.employee.employeeCode} · raised {new Date(req.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <DateTile iso={req.workedDate} label="Worked on" tone="warning" />
                    <span style={{ color: 'var(--foreground-muted)' }} aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                    <DateTile iso={req.requestedDate} label="Comp-off on" tone="success" />
                  </div>
                  {(req.reason || req.rejectionReason) && (
                    <div className="min-w-0 max-w-xs text-xs">
                      {req.reason && <div className="truncate" title={req.reason} style={{ color: 'var(--foreground-muted)' }}>“{req.reason}”</div>}
                      {req.rejectionReason && <div className="truncate" title={req.rejectionReason} style={{ color: 'var(--danger)' }}>Rejected: {req.rejectionReason}</div>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={statusTone(req.status)} size="sm" dot>{req.status}</StatusBadge>
                  {isHr && req.status === 'pending' && (
                    <>
                      <Button variant="success" size="xs" onClick={() => handleApprove(req.id)}>Approve</Button>
                      <Button variant="danger" size="xs" onClick={() => setRejectId(req.id)}>Reject</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-md space-y-4 rounded-xl border p-5 shadow-xl" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Request Comp-off</h2>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--foreground-muted)' }}>The worked date must be a weekly off / holiday with approved OT that hasn’t already been settled as comp-off.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Worked date</label>
                <input type="date" value={formData.workedDate} onChange={(e) => setFormData({ ...formData, workedDate: e.target.value })} className={inputCls} style={inputStyle} />
                {formData.workedDate && <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{fmtDate(formData.workedDate)}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Comp-off date</label>
                <input type="date" value={formData.requestedDate} onChange={(e) => setFormData({ ...formData, requestedDate: e.target.value })} className={inputCls} style={inputStyle} />
                {formData.requestedDate && <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>{fmtDate(formData.requestedDate)}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>Reason (optional)</label>
              <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} rows={2} className={inputCls} style={inputStyle} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" loading={submitting} disabled={!formData.workedDate || !formData.requestedDate} onClick={handleSubmit}>Submit Request</Button>
            </div>
          </div>
        </div>
      )}

      <FormModal
        title="Reject Comp-off Request"
        fields={rejectFields}
        initialValues={{}}
        isOpen={rejectId !== null}
        onClose={() => setRejectId(null)}
        onSubmit={handleReject}
        submitLabel="Reject"
      />
    </div>
  );
}
