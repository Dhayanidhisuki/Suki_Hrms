'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Button,
  DataTable,
  KPICard,
  KPIGrid,
  PageHeader,
  SearchableSelect,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { payableStatuses, FNF_STATUS_TONE } from '@/lib/fnf/workflow';
import FnFOverview from '@/components/fnf/FnFOverview';
import { formatInr } from '@/lib/fnf/presentation';

interface FnFLine {
  id: number;
  kind: 'EARNING' | 'DEDUCTION';
  code: string;
  name: string;
  source: string;
  amount: string | number;
  editable: boolean;
  remark: string | null;
}

interface FnFSettlement {
  id: number;
  employeeId: number;
  lastWorkingDay: string;
  settlementDate: string | null;
  unpaidSalary: string;
  leaveEncashment: string;
  leaveEncashmentDays: number;
  payableDays: number;
  salaryDivisor: number;
  noticeServedDays: number;
  noticeWaivedDays: number;
  noticeShortfallDays: number;
  overrideRemark: string | null;
  rejectionReason: string | null;
  remarks: string | null;
  totalPayable: string;
  totalRecovery: string;
  netPayable: string;
  status: string;
  paymentDate: string | null;
  paymentReference: string | null;
  snapshotJson: string | null;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    bankDetail?: { accountNumber?: string | null; bankName?: string | null; ifscCode?: string | null } | null;
    jobInfos?: {
      joinDate: string;
      paymentMode?: string | null;
      esiApplicable?: boolean;
      department?: { name: string } | null;
      designation?: { name: string } | null;
    }[];
  };
  exitInterview: { exitDate: string; exitType: string; clearanceStatus?: string; clearanceChecks?: { checkCode: string; status: string }[] };
  freezeSnapshotId?: number | null;
  lines: FnFLine[];
  employeeCode?: string;
  name?: string;
}

interface EligibleExit {
  id: number;
  employeeId: number;
  exitDate: string;
  lastWorkingDay?: string;
  exitType: string;
  noticePeriodDays?: number | null;
  clearanceStatus?: string;
  fnfId?: number | null;
  eligibility?: { ok: boolean; issues: { code: string; message: string }[] };
  employee: { id: number; employeeCode: string; firstName: string; lastName: string; department?: string; designation?: string };
}

function money(v: string | number | null | undefined) {
  return formatInr(v);
}

function promptText(message: string): string | null {
  const v = window.prompt(message);
  return v == null ? null : v.trim();
}

export default function FnFPage() {
  const [records, setRecords] = useState<FnFSettlement[]>([]);
  const [eligible, setEligible] = useState<EligibleExit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FnFSettlement | null>(null);
  const [exitId, setExitId] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);
  const [served, setServed] = useState('0');
  const [waived, setWaived] = useState('0');
  const [editLines, setEditLines] = useState<FnFLine[]>([]);
  // The company's configured approval chain, from the list endpoint. Under
  // HR_FINANCE an approved settlement is NOT yet payable, and offering the
  // button anyway just earns the user a 409 from mark-paid.
  const [approvalStages, setApprovalStages] = useState<string>('HR_FINANCE');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, eligRes] = await Promise.all([
        fetch('/api/payroll/fnf'),
        fetch('/api/payroll/fnf/eligible'),
      ]);
      if (!listRes.ok) {
        const j = await listRes.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load settlements');
      }
      const json = await listRes.json();
      const mapped = (json.data ?? []).map((s: FnFSettlement) => ({
        ...s,
        employeeCode: s.employee.employeeCode,
        name: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
        lastWorkingDay: s.lastWorkingDay?.slice(0, 10) ?? '',
        lines: s.lines ?? [],
      }));
      setRecords(mapped);
      if (json.approvalStages) setApprovalStages(json.approvalStages);
      if (eligRes.ok) {
        const elig = await eligRes.json();
        setEligible(elig.data ?? []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('open'));
    if (Number.isFinite(id) && id > 0) void refreshSelected(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSelected = async (id: number) => {
    const res = await fetch(`/api/payroll/fnf/${id}`);
    if (!res.ok) return;
    const s: FnFSettlement = await res.json();
    s.employeeCode = s.employee.employeeCode;
    s.name = `${s.employee.firstName} ${s.employee.lastName}`.trim();
    s.lastWorkingDay = s.lastWorkingDay?.slice(0, 10) ?? '';
    setSelected(s);
    setEditLines(s.lines ?? []);
    setServed(String(s.noticeServedDays ?? 0));
    setWaived(String(s.noticeWaivedDays ?? 0));
    await fetchData();
  };

  const postAction = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? 'Action failed');
      return null;
    }
    setError(null);
    return j;
  };

  const handleCreate = async () => {
    const chosen = eligible.find((e) => e.id === exitId);
    if (!chosen) {
      setError('Search and select a separated employee');
      return;
    }
    setCreating(true);
    try {
      const created = await postAction('/api/payroll/fnf', {
        employeeId: chosen.employeeId,
        exitInterviewId: chosen.id,
      });
      if (created) {
        setExitId('');
        await fetchData();
        await refreshSelected(created.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<FnFSettlement>[] = [
    { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'lastWorkingDay', label: 'LWD', sortable: true },
    { key: 'payableDays', label: 'Days' },
    {
      key: 'netPayable',
      label: 'Net payable',
      render: (r) => money(r.netPayable),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <StatusBadge tone={FNF_STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</StatusBadge>
      ),
    },
  ];

  const kpis = {
    open: records.filter((r) => !['paid', 'completed', 'cancelled'].includes(r.status)).length,
    submitted: records.filter((r) => r.status === 'submitted' || r.status === 'pending_manager').length,
    approved: records.filter((r) => r.status === 'approved' || r.status === 'finance_verified').length,
    paid: records.filter((r) => r.status === 'paid' || r.status === 'completed').length,
  };

  const canEdit = selected && ['pending', 'reopened', 'calculated', 'on_hold'].includes(selected.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Full & Final Settlement"
        description="Search a separated employee (code or name). Clearance, then freeze salary as of LWD, submit → approve → finance verify → pay → complete."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <KPIGrid columns={4}>
        <KPICard label="In progress" value={kpis.open} tone="info" />
        <KPICard label="Submitted" value={kpis.submitted} tone="warning" />
        <KPICard label="Approved" value={kpis.approved} tone="success" />
        <KPICard label="Paid / completed" value={kpis.paid} tone="success" />
      </KPIGrid>

      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <h2 className="text-sm font-semibold">Open settlement</h2>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Only employees with a recorded separation and no existing F&F appear here (search by code or name).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1">
            <SearchableSelect
              value={exitId}
              options={eligible.filter((e) => !e.fnfId).map((e) => ({
                value: e.id,
                label: `${e.employee.employeeCode} — ${e.employee.firstName} ${e.employee.lastName} (${e.exitType}, LWD ${(e.lastWorkingDay ?? e.exitDate).slice(0, 10)}${e.employee.designation ? `, ${e.employee.designation}` : ''}${e.eligibility && !e.eligibility.ok ? ' — clearance pending' : ''})`,
              }))}
              onChange={(v) => setExitId(v === '' ? '' : Number(v))}
            />
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={!exitId}>
            Create draft
          </Button>
          <a
            href="/api/payroll/fnf/bank-file"
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Payment file (verified)
          </a>
        </div>
      </div>

      <DataTable
        data={records}
        columns={columns}
        loading={loading}
        emptyMessage="No F&F settlements yet. Record a separation on Exit Form, then create a draft here."
        renderRowActions={(row) => (
          <Button size="xs" variant="ghost" onClick={() => refreshSelected(row.id)}>
            Open
          </Button>
        )}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div
            className="flex w-full max-w-[1100px] max-h-[94vh] flex-col overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto p-5">
              <FnFOverview
                settlement={selected}
                lines={canEdit ? editLines : selected.lines}
                canEdit={Boolean(canEdit)}
                served={served}
                waived={waived}
                onServedChange={setServed}
                onWaivedChange={setWaived}
                onLineAmountChange={(idx, amount) => {
                  const next = [...editLines];
                  if (!next[idx]) return;
                  next[idx] = { ...next[idx], amount };
                  setEditLines(next);
                }}
              />
              {selected.overrideRemark && (
                <div className="mt-3">
                  <Alert tone="warning">Override: {selected.overrideRemark}</Alert>
                </div>
              )}
              {selected.rejectionReason && (
                <div className="mt-3">
                  <Alert tone="danger">{selected.rejectionReason}</Alert>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--border)' }}>
              {canEdit && (
                <>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const payload: Record<string, unknown> = {
                        noticeServedDays: Number(served) || 0,
                        noticeWaivedDays: Number(waived) || 0,
                      };
                      if (selected.exitInterview.clearanceStatus !== 'CLEARED') {
                        const remark = promptText('Clearance incomplete. Override remark (required):');
                        if (!remark) return;
                        payload.clearanceOverrideRemark = remark;
                      }
                      const j = await postAction(`/api/payroll/fnf/${selected.id}/calculate`, payload);
                      if (j) await refreshSelected(selected.id);
                    }}
                  >
                    Calculate / freeze
                  </Button>
                  {editLines.some((l) => l.editable) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const remark = promptText('Override remark (required):');
                        if (!remark) return;
                        const res = await fetch(`/api/payroll/fnf/${selected.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            remark,
                            lines: editLines.map((l) => ({
                              kind: l.kind,
                              code: l.code,
                              name: l.name,
                              source: l.source,
                              amount: Number(l.amount),
                              editable: l.editable,
                              remark: l.remark,
                            })),
                          }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) setError(j.error ?? 'Override failed');
                        else await refreshSelected(selected.id);
                      }}
                    >
                      Save overrides
                    </Button>
                  )}
                </>
              )}
              {selected.status === 'pending_manager' && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={async () => {
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/manager-approve`);
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Manager approve
                </Button>
              )}
              {selected.status === 'calculated' && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={async () => {
                      const j = await postAction(`/api/payroll/fnf/${selected.id}/submit`);
                      if (j) await refreshSelected(selected.id);
                    }}
                  >
                    Submit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const reason = promptText('Rejection reason:');
                      if (!reason) return;
                      const j = await postAction(`/api/payroll/fnf/${selected.id}/reject`, { rejectionReason: reason });
                      if (j) await refreshSelected(selected.id);
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {selected.status === 'pending_manager' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    const reason = promptText('Rejection reason:');
                    if (!reason) return;
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/reject`, { rejectionReason: reason });
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Reject
                </Button>
              )}
              {selected.status === 'submitted' && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={async () => {
                      const j = await postAction(`/api/payroll/fnf/${selected.id}/approve`);
                      if (j) await refreshSelected(selected.id);
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const reason = promptText('Rejection reason:');
                      if (!reason) return;
                      const j = await postAction(`/api/payroll/fnf/${selected.id}/reject`, { rejectionReason: reason });
                      if (j) await refreshSelected(selected.id);
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {selected.status === 'approved' && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={async () => {
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/finance-verify`);
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Finance verify
                </Button>
              )}
              {payableStatuses(approvalStages).has(selected.status) && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const ref = promptText('Payment reference (UTR / cheque):');
                    if (ref == null) return;
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/mark-paid`, {
                      paymentReference: ref || undefined,
                    });
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Mark paid
                </Button>
              )}
              {selected.status === 'paid' && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={async () => {
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/complete`);
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Complete
                </Button>
              )}
              {['calculated', 'pending_manager', 'submitted'].includes(selected.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const reason = promptText('Hold reason:');
                    if (!reason) return;
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/hold`, { reason });
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Hold
                </Button>
              )}
              {['approved', 'finance_verified', 'rejected', 'calculated', 'pending_manager', 'submitted', 'on_hold'].includes(selected.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const remark = promptText('Reopen remark:');
                    if (!remark) return;
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/reopen`, { remark });
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Reopen
                </Button>
              )}
              {['pending', 'reopened', 'calculated', 'on_hold'].includes(selected.status) && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    const reason = promptText('Cancel reason:');
                    if (!reason) return;
                    const j = await postAction(`/api/payroll/fnf/${selected.id}/cancel`, { reason });
                    if (j) await refreshSelected(selected.id);
                  }}
                >
                  Cancel
                </Button>
              )}
              {['calculated', 'submitted', 'pending_manager', 'approved', 'finance_verified', 'paid', 'completed'].includes(selected.status) && (
                <a href={`/api/payroll/fnf/${selected.id}/pdf`} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  PDF
                </a>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
