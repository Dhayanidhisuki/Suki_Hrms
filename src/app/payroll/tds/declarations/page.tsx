/**
 * TDS Investment Declarations — list all declarations for the company,
 * approve/reject pending ones, and view proofs.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface Declaration {
  id: number;
  employeeId: number;
  financialYear: number;
  regime: string;
  section80C: string;
  section80D: string;
  hraExemption: string;
  otherIncome: string;
  status: string;
  rejectionReason: string | null;
  remarks: string | null;
  createdAt: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
  proofs: Array<{ id: number; section: string; amount: string; status: string }>;
  [key: string]: unknown;
}

const columns: Column<Declaration>[] = [
  { key: 'employeeCode', label: 'Code', sortable: true, className: 'font-medium' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'financialYear', label: 'FY', sortable: true },
  { key: 'regime', label: 'Regime', sortable: true },
  { key: 'section80C', label: '80C' },
  { key: 'section80D', label: '80D' },
  { key: 'hraExemption', label: 'HRA' },
  { key: 'otherIncome', label: 'Other Inc' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'proofs', label: 'Proofs' },
];

export default function TdsDeclarationsPage() {
  const [records, setRecords] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/tds/declarations');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const mapped = (json.data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        employeeCode: (d.employee as Record<string, unknown>).employeeCode as string,
        name: `${(d.employee as Record<string, unknown>).firstName} ${(d.employee as Record<string, unknown>).lastName}`.trim(),
        proofs: (d.proofs as Array<{ id: number; section: string; amount: string; status: string }>) ?? [],
      })) as Declaration[];
      setRecords(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/payroll/tds/declarations/${id}/approve`, { method: 'POST' });
    if (res.ok) fetchData();
    else alert('Failed to approve');
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason) return;
    const res = await fetch(`/api/payroll/tds/declarations/${rejectId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason: rejectReason }),
    });
    if (res.ok) {
      setRejectId(null);
      setRejectReason('');
      fetchData();
    } else {
      alert('Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>TDS Investment Declarations</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Review and approve employee investment declarations for TDS calculation.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <DataTable
          data={records}
          columns={columns}
          emptyMessage="No declarations submitted"
          renderRowActions={(row) => (
            <div className="flex gap-2">
              {row.status === 'pending_hr' && (
                <>
                  <button
                    onClick={() => handleApprove(row.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => { setRejectId(row.id); setRejectReason(''); }}
                    className="rounded px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--danger)' }}
                  >
                    Reject
                  </button>
                </>
              )}
              {row.proofs.length > 0 && (
                <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  {row.proofs.length} proof(s)
                </span>
              )}
            </div>
          )}
        />
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl border p-6 w-96 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h2 className="text-sm font-semibold">Reject Declaration</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason…"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectId(null)} className="rounded-lg px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={handleReject} className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: 'var(--danger)' }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
