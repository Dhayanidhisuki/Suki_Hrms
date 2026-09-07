/**
 * Exit Form — records an employee's separation (ExitInterview), the
 * prerequisite Gratuity Phase 1 needed. One per employee (enforced by the
 * API, 409 on a duplicate). Recording a separation also flips the
 * employee's status to resigned/terminated.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, SearchableSelect, type Column } from '@/components/ui';
import Link from 'next/link';

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface SeparationRow {
  id: number;
  employeeId: number;
  employee: { employeeCode: string; firstName: string; lastName: string };
  exitDate: string;
  exitType: string;
  exitReason: string | null;
  gratuityRecord: { id: number; status: string } | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExitFormPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [separations, setSeparations] = useState<SeparationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [exitDate, setExitDate] = useState(todayIso());
  const [exitType, setExitType] = useState<'resignation' | 'termination' | 'retirement'>('resignation');
  const [exitReason, setExitReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, sepRes] = await Promise.all([
        fetch('/api/employees?limit=500'),
        fetch('/api/employees/separations'),
      ]);
      if (!empRes.ok || !sepRes.ok) throw new Error('Failed to fetch');
      const empJson: { data: EmployeeOption[] } = await empRes.json();
      const sepJson: { data: SeparationRow[] } = await sepRes.json();
      setEmployees(empJson.data ?? []);
      setSeparations(sepJson.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const separatedEmployeeIds = new Set(separations.map((s) => s.employeeId));
  const eligibleEmployees = employees.filter((e) => !separatedEmployeeIds.has(e.id));

  const submit = async () => {
    setError(null);
    if (!employeeId) {
      setError('Select an employee');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitDate, exitType, exitReason: exitReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to record separation');
      }
      setEmployeeId('');
      setExitDate(todayIso());
      setExitType('resignation');
      setExitReason('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record separation');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<SeparationRow>[] = [
    { key: 'employee', label: 'Employee', render: (r) => `${r.employee.employeeCode} — ${r.employee.firstName} ${r.employee.lastName}` },
    { key: 'exitDate', label: 'Exit Date', render: (r) => new Date(r.exitDate).toLocaleDateString() },
    { key: 'exitType', label: 'Type', render: (r) => r.exitType.charAt(0).toUpperCase() + r.exitType.slice(1) },
    { key: 'exitReason', label: 'Reason', render: (r) => r.exitReason ?? '—' },
    {
      key: 'gratuity',
      label: 'Gratuity',
      render: (r) =>
        r.gratuityRecord ? (
          <Link href="/payroll/processing/gratuity" className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            {r.gratuityRecord.status}
          </Link>
        ) : (
          <Link href="/payroll/processing/gratuity" className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            Not calculated
          </Link>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Exit Form</h1>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Record a Separation</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee <span className="text-red-500">*</span></label>
            <SearchableSelect
              value={employeeId}
              options={eligibleEmployees.map((e) => ({ label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`, value: e.id }))}
              onChange={(v) => setEmployeeId(v === '' ? '' : Number(v))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Exit Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Exit Type <span className="text-red-500">*</span></label>
            <select
              value={exitType}
              onChange={(e) => setExitType(e.target.value as typeof exitType)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <option value="resignation">Resignation</option>
              <option value="termination">Termination</option>
              <option value="retirement">Retirement</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Reason</label>
            <input
              type="text"
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            disabled={submitting}
            onClick={submit}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {submitting ? 'Saving...' : 'Record Separation'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recorded Separations</h2>
        <DataTable columns={columns} data={separations} loading={loading} emptyMessage="No separations recorded yet." />
      </div>
    </div>
  );
}
