/**
 * Employee Self Service — Payslip Download. Self-service: always the
 * logged-in user's own payroll lines, resolved server-side. Only published
 * (APPROVED/LOCKED) months are listed — a payslip still being processed by
 * HR is not shown. Read-only: reuses PayslipView, the same rendering the
 * HR payslip page uses, with no ad-hoc editing controls.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PayslipView, fmt, type PayrollLineDetail } from '@/components/payroll/PayslipView';
import { useToast } from '@/components/ui';

interface PayslipListRow {
  id: number;
  netSalary: string | null;
  status: string;
  payrollStatus: 'PUBLISHED' | 'PROCESSING';
  processedOn: string | null;
  payslipAvailable: boolean;
  payrollRun: { id: number; year: number; month: number; status: string };
}

function monthLabel(year: number, month: number) {
  return `${new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`;
}

export default function EssPayslipPage() {
  const [list, setList] = useState<PayslipListRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [line, setLine] = useState<PayrollLineDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingLine, setLoadingLine] = useState(false);
  const toast = useToast();

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/workforce/my-payslips');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load payslips');
      }
      const json = await res.json();
      setList(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payslips');
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const fetchLine = useCallback(async (id: number) => {
    setLoadingLine(true);
    try {
      const res = await fetch(`/api/workforce/my-payslips/${id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load payslip');
      }
      setLine(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payslip');
    } finally {
      setLoadingLine(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedId) void fetchLine(selectedId);
  }, [selectedId, fetchLine]);

  if (selectedId && line) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm font-medium print:hidden"
          style={{ color: 'var(--primary)' }}
        >
          ← Back to Payslips
        </button>
        <PayslipView line={line} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Payslips</h1>

      {loadingList || loadingLine ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No payroll has been run for you yet.
        </div>
      ) : (
        <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Net Salary</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2">{monthLabel(row.payrollRun.year, row.payrollRun.month)}</td>
                  <td className="px-4 py-2">
                    {row.payrollStatus === 'PUBLISHED' ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>Published</span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>Processing</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {row.payslipAvailable ? `₹${fmt(row.netSalary ?? '0')}` : <span style={{ color: 'var(--foreground-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.payslipAvailable ? (
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => setSelectedId(row.id)}
                          className="rounded-lg border px-3 py-1 text-xs font-medium"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => window.open(`/api/workforce/my-payslips/${row.id}/pdf`, '_blank')}
                          className="rounded-lg border px-3 py-1 text-xs font-medium"
                          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                          title="Download payslip PDF (FORM-25B format)"
                        >
                          Download PDF
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Payroll in progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
