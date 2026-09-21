/**
 * Exit Form — records an employee's separation (ExitInterview), the
 * prerequisite Gratuity Phase 1 needed. One per employee (enforced by the
 * API, 409 on a duplicate). Recording a separation also flips the
 * employee's status to resigned/terminated.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';
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
  clearanceStatus?: string;
  clearanceChecks?: { checkCode: string; status: string }[];
  gratuityRecord: { id: number; status: string } | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExitFormPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [separations, setSeparations] = useState<SeparationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [exitDate, setExitDate] = useState(todayIso());
  const [exitType, setExitType] = useState<'resignation' | 'termination' | 'retirement' | 'death' | 'absconding' | 'contract_expiry' | 'other'>('resignation');
  const [exitReason, setExitReason] = useState('');
  const [resignationDate, setResignationDate] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [noticeServedDays, setNoticeServedDays] = useState('0');
  const [noticeWaivedDays, setNoticeWaivedDays] = useState('0');
  const [approvedLastWorkingDay, setApprovedLastWorkingDay] = useState(todayIso());
  const [rehireEligible, setRehireEligible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const separatedEmployeeIds = new Set(separations.map((s) => s.employeeId));
  const eligibleEmployees = employees.filter((e) => !separatedEmployeeIds.has(e.id));

  const submit = async () => {
    if (!employeeId) {
      toast.warning('Select an employee');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exitDate,
          exitType,
          exitReason: exitReason || undefined,
          resignationDate: resignationDate || undefined,
          noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
          noticeServedDays: noticeServedDays ? Number(noticeServedDays) : undefined,
          noticeWaivedDays: noticeWaivedDays ? Number(noticeWaivedDays) : undefined,
          approvedLastWorkingDay: approvedLastWorkingDay || undefined,
          rehireEligible,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to record separation');
      }
      setEmployeeId('');
      setExitDate(todayIso());
      setExitType('resignation');
      setExitReason('');
      setResignationDate('');
      setNoticePeriodDays('30');
      setNoticeServedDays('0');
      setNoticeWaivedDays('0');
      setApprovedLastWorkingDay(todayIso());
      setRehireEligible(true);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record separation');
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
      key: 'clearance',
      label: 'Clearance',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(['MANAGER', 'IT', 'FINANCE', 'HR'] as const).map((code) => {
            const row = r.clearanceChecks?.find((c) => c.checkCode === code);
            const cleared = row?.status === 'CLEARED' || r.clearanceStatus === 'CLEARED';
            return (
              <button
                key={code}
                type="button"
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: cleared ? '#dcfce7' : '#fef9c3',
                  color: cleared ? '#166534' : '#854d0e',
                }}
                onClick={async () => {
                  const res = await fetch(`/api/employees/${r.employeeId}/exit/clearance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkCode: code, status: cleared ? 'PENDING' : 'CLEARED' }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.error ?? 'Clearance update failed');
                    return;
                  }
                  await fetchData();
                }}
              >
                {code}
              </button>
            );
          })}
        </div>
      ),
    },
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
              <option value="death">Death</option>
              <option value="absconding">Absconding</option>
              <option value="contract_expiry">Contract expiry</option>
              <option value="other">Other</option>
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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Resignation date</label>
            <input
              type="date"
              value={resignationDate}
              onChange={(e) => setResignationDate(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Notice period (days)</label>
            <input
              type="number"
              min={0}
              value={noticePeriodDays}
              onChange={(e) => setNoticePeriodDays(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Notice served (days)</label>
            <input
              type="number"
              min={0}
              value={noticeServedDays}
              onChange={(e) => setNoticeServedDays(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Notice waived (days)</label>
            <input
              type="number"
              min={0}
              value={noticeWaivedDays}
              onChange={(e) => setNoticeWaivedDays(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Approved last working day</label>
            <input
              type="date"
              value={approvedLastWorkingDay}
              onChange={(e) => setApprovedLastWorkingDay(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
            <input type="checkbox" checked={rehireEligible} onChange={(e) => setRehireEligible(e.target.checked)} />
            Eligible for rehire
          </label>
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
