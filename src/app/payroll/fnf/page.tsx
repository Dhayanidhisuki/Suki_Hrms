/**
 * Full & Final Settlement — list all settlements, calculate, approve,
 * reject, and mark as paid.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, useToast, type Column } from '@/components/ui';

interface FnFSettlement {
  id: number;
  employeeId: number;
  lastWorkingDay: string;
  settlementDate: string | null;
  unpaidSalary: string;
  leaveEncashment: string;
  leaveEncashmentDays: number;
  gratuity: string;
  bonusProportion: string;
  noticePay: string;
  loanRecovery: string;
  assetRecovery: string;
  totalPayable: string;
  totalRecovery: string;
  netPayable: string;
  status: string;
  paymentDate: string | null;
  paymentReference: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
  exitInterview: { exitDate: string; exitType: string };
  [key: string]: unknown;
}

const columns: Column<FnFSettlement>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'lastWorkingDay', label: 'LWD', sortable: true },
  { key: 'netPayable', label: 'Net Payable', sortable: true },
  { key: 'totalPayable', label: 'Payable' },
  { key: 'totalRecovery', label: 'Recovery' },
  { key: 'status', label: 'Status', sortable: true },
];

export default function FnFPage() {
  const toast = useToast();
  const [records, setRecords] = useState<FnFSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FnFSettlement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/fnf');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const mapped = (json.data ?? []).map((s: Record<string, unknown>) => ({
        ...s,
        employeeCode: (s.employee as Record<string, unknown>).employeeCode as string,
        name: `${(s.employee as Record<string, unknown>).firstName} ${(s.employee as Record<string, unknown>).lastName}`.trim(),
        lastWorkingDay: (s.lastWorkingDay as string)?.slice(0, 10) ?? '',
        settlementDate: s.settlementDate ? (s.settlementDate as string).slice(0, 10) : null,
        paymentDate: s.paymentDate ? (s.paymentDate as string).slice(0, 10) : null,
      })) as FnFSettlement[];
      setRecords(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCalculate = async (id: number) => {
    const res = await fetch(`/api/payroll/fnf/${id}/calculate`, { method: 'POST' });
    if (res.ok) fetchData();
    else { const j = await res.json().catch(() => ({})); toast.error(j.error ?? 'Failed to calculate'); }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/fnf/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData();
    else toast.error('Failed to approve');
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch(`/api/payroll/fnf/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (res.ok) fetchData();
    else toast.error('Failed to reject');
  };

  const handleMarkPaid = async (id: number) => {
    const ref = prompt('Payment reference (cheque/UTR):', '');
    if (ref === null) return;
    const res = await fetch(`/api/payroll/fnf/${id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReference: ref || undefined }),
    });
    if (res.ok) fetchData();
    else toast.error('Failed to mark as paid');
  };

  const fmt = (v: string) => Number(v).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Full & Final Settlement</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Calculate, approve, and pay terminal settlements for exiting employees.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={records}
          columns={columns}
          emptyMessage="No FnF settlements"
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {row.status === 'pending' && (
                <button onClick={() => handleCalculate(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  Calculate
                </button>
              )}
              {row.status === 'calculated' && (
                <>
                  <button onClick={() => setSelected(row)} className="rounded px-2 py-1 text-xs font-medium" style={{ color: 'var(--primary)' }}>
                    View
                  </button>
                  <button onClick={() => handleApprove(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>
                    Approve
                  </button>
                  <button onClick={() => handleReject(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>
                    Reject
                  </button>
                </>
              )}
              {row.status === 'approved' && (
                <button onClick={() => handleMarkPaid(row.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  Mark Paid
                </button>
              )}
              {row.status === 'paid' && (
                <span className="text-xs" style={{ color: 'var(--success)' }}>Paid{row.paymentDate ? ` on ${row.paymentDate}` : ''}</span>
              )}
            </div>
          )}
        />
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div className="rounded-xl border p-6 w-[600px] max-h-[80vh] overflow-y-auto space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{`FnF Settlement — ${String(selected.employeeCode)}`}</h2>
              <button onClick={() => setSelected(null)} className="text-sm">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Unpaid Salary</span><span className="font-medium">{fmt(selected.unpaidSalary)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Leave Encashment</span><span className="font-medium">{fmt(selected.leaveEncashment)} ({selected.leaveEncashmentDays} days)</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Gratuity</span><span className="font-medium">{fmt(selected.gratuity)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Bonus Proportion</span><span className="font-medium">{fmt(selected.bonusProportion)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Notice Pay</span><span className="font-medium">{fmt(selected.noticePay)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Loan Recovery</span><span className="font-medium" style={{ color: 'var(--danger)' }}>{fmt(selected.loanRecovery)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Asset Recovery</span><span className="font-medium" style={{ color: 'var(--danger)' }}>{fmt(selected.assetRecovery)}</span></div>
            </div>

            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--foreground-muted)' }}>Total Payable</span><span className="font-semibold" style={{ color: 'var(--success)' }}>{fmt(selected.totalPayable)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--foreground-muted)' }}>Total Recovery</span><span className="font-semibold" style={{ color: 'var(--danger)' }}>{fmt(selected.totalRecovery)}</span></div>
              <div className="flex justify-between text-sm mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}><span className="font-semibold">Net Payable</span><span className="font-bold text-base">{fmt(selected.netPayable)}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => handleApprove(selected.id)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--success)' }}>Approve</button>
              <button onClick={() => { handleReject(selected.id); setSelected(null); }} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
