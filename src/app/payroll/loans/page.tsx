/**
 * Loans — list all loans for the company, approve/reject pending ones,
 * disburse approved ones, and view loan statements.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, useToast, type Column } from '@/components/ui';

interface Loan {
  id: number;
  code: string;
  principal: string;
  interestRate: string;
  tenureMonths: number;
  installmentAmount: string;
  status: string;
  outstandingBalance: string;
  installmentsPaid: number;
  disbursementDate: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  loanType: { code: string; name: string };
  [key: string]: unknown;
}

const columns: Column<Loan>[] = [
  { key: 'code', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'employeeCode', label: 'Employee', sortable: true },
  { key: 'loanType', label: 'Type' },
  { key: 'principal', label: 'Principal', sortable: true },
  { key: 'installmentAmount', label: 'EMI' },
  { key: 'tenureMonths', label: 'Tenure' },
  { key: 'outstandingBalance', label: 'Outstanding', sortable: true },
  { key: 'installmentsPaid', label: 'Paid' },
  { key: 'status', label: 'Status', sortable: true },
];

export default function LoansPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [disburseId, setDisburseId] = useState<number | null>(null);
  const [disburseRef, setDisburseRef] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/loans');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const mapped = (json.data ?? []).map((l: Record<string, unknown>) => ({
        ...l,
        employeeCode: (l.employee as Record<string, unknown>).employeeCode as string,
        employeeName: `${(l.employee as Record<string, unknown>).firstName} ${(l.employee as Record<string, unknown>).lastName}`.trim(),
        loanType: `${(l.loanType as Record<string, unknown>).code}`,
      })) as Loan[];
      setRecords(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/loans/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData();
    else toast.error('Failed to approve');
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await fetch(`/api/payroll/loans/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: reason }),
    });
    if (res.ok) fetchData();
    else toast.error('Failed to reject');
  };

  const handleDisburse = async () => {
    if (!disburseId) return;
    const res = await fetch(`/api/payroll/loans/${disburseId}/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disbursementReference: disburseRef || undefined }),
    });
    if (res.ok) {
      setDisburseId(null);
      setDisburseRef('');
      fetchData();
    } else {
      toast.error('Failed to disburse');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Loans & Advances</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Manage employee loans — approve, disburse, and track repayments.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={records}
          columns={columns}
          emptyMessage="No loans found"
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {row.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprove(row.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(row.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--danger)' }}
                  >
                    Reject
                  </button>
                </>
              )}
              {row.status === 'approved' && (
                <button
                  onClick={() => { setDisburseId(row.id); setDisburseRef(''); }}
                  className="rounded px-2 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Disburse
                </button>
              )}
              {(row.status === 'active' || row.status === 'closed') && (
                <a
                  href={`/api/payroll/loans/${row.id}/statement`}
                  target="_blank"
                  className="rounded px-2 py-1 text-xs font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  Statement
                </a>
              )}
            </div>
          )}
        />
      )}

      {disburseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl border p-6 w-96 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold">Disburse Loan</h2>
            <input
              type="text"
              value={disburseRef}
              onChange={(e) => setDisburseRef(e.target.value)}
              placeholder="Disbursement reference (cheque/UTR)…"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDisburseId(null)} className="rounded-lg px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={handleDisburse} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary)' }}>
                Disburse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
