/**
 * Leave History — one employee's balances (per leave type, for a year) and
 * full application history (BRD §12).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/ui';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}
interface BalanceRow {
  id: number;
  openingBalance: string;
  accrued: string;
  availed: string;
  adjusted: string;
  closingBalance: string;
  carryForwardIn: string;
  leaveMaster: { code: string; name: string };
}
interface ApplicationRow {
  id: number;
  fromDate: string;
  toDate: string;
  numberOfDays: string;
  status: string;
  leaveMaster: { code: string; name: string };
}

const now = new Date();

export default function LeaveHistoryPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then((r) => r.json())
      .then((json: { data: EmployeeOption[] }) => {
        setEmployees(json.data ?? []);
        if (json.data?.length) setEmployeeId(json.data[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workforce/leave/history?employeeId=${employeeId}&year=${year}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: { balances: BalanceRow[]; applications: ApplicationRow[] } = await res.json();
      setBalances(json.balances);
      setApplications(json.applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const balanceColumns: Column<BalanceRow>[] = [
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'openingBalance', label: 'Opening' },
    { key: 'accrued', label: 'Accrued' },
    { key: 'availed', label: 'Availed' },
    { key: 'adjusted', label: 'Adjusted' },
    { key: 'closingBalance', label: 'Closing' },
  ];

  const applicationColumns: Column<ApplicationRow>[] = [
    { key: 'leaveMaster', label: 'Leave Type', render: (r) => r.leaveMaster.name },
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString() },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString() },
    { key: 'numberOfDays', label: 'Days' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Leave History
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={employeeId ?? ''}
            onChange={(e) => setEmployeeId(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Balances
        </h2>
        <DataTable columns={balanceColumns} data={balances} loading={loading} emptyMessage="No balance records for this year." />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Applications
        </h2>
        <DataTable columns={applicationColumns} data={applications} loading={loading} emptyMessage="No leave applications for this year." />
      </div>
    </div>
  );
}
