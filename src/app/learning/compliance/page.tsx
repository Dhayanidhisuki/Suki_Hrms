'use client';

/**
 * Mandatory Training Compliance (BRD §39/§42) — per-employee status for all
 * MANDATORY nominations: compliant / overdue / pending / not started.
 */

import { useState, useEffect } from 'react';
import { DataTable, KPICard, KPIGrid } from '@/components/ui';
import type { Column } from '@/components/ui';
import { exportCsv } from '@/lib/exportCsv';
import { exportXlsx } from '@/lib/exportXlsx';
import { printTable } from '@/lib/printTable';

interface Row {
  id: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationName: string;
  program: string;
  scheduledDate: string;
  nominationStatus: string;
  compliance: string;
}

const TONE: Record<string, { bg: string; fg: string }> = {
  COMPLIANT: { bg: '#dcfce7', fg: '#166534' },
  OVERDUE: { bg: '#fee2e2', fg: '#991b1b' },
  PENDING: { bg: '#fef9c3', fg: '#854d0e' },
  NOT_STARTED: { bg: '#dbeafe', fg: '#1e40af' },
  NOT_COMPLETED: { bg: '#fee2e2', fg: '#991b1b' },
  EXEMPTED: { bg: '#f1f5f9', fg: '#475569' },
};

export default function CompliancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState({ total: 0, compliant: 0, overdue: 0, notStarted: 0, pending: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/training-compliance${status ? `?status=${status}` : ''}`);
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        if (!mounted) return;
        setRows(json.data);
        setKpis(json.kpis);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [status]);

  const columns: Column<Row>[] = [
    { key: 'employeeCode', label: 'Code' },
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'departmentName', label: 'Department' },
    { key: 'designationName', label: 'Role' },
    { key: 'program', label: 'Mandatory Training' },
    { key: 'scheduledDate', label: 'Scheduled' },
    { key: 'nominationStatus', label: 'Nomination' },
    {
      key: 'compliance', label: 'Compliance',
      render: (r) => {
        const t = TONE[r.compliance] ?? TONE.PENDING;
        return <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{r.compliance.replace('_', ' ')}</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Mandatory Training Compliance</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('training-compliance.csv', rows.map((r) => ({
              Code: r.employeeCode, Employee: r.employeeName, Department: r.departmentName, Role: r.designationName,
              Training: r.program, Scheduled: r.scheduledDate, Nomination: r.nominationStatus, Compliance: r.compliance,
            })))}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => exportXlsx('training-compliance.xlsx', rows.map((r) => ({
              Code: r.employeeCode, Employee: r.employeeName, Department: r.departmentName, Role: r.designationName,
              Training: r.program, Scheduled: r.scheduledDate, Nomination: r.nominationStatus, Compliance: r.compliance,
            })), 'Compliance')}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => printTable('Mandatory Training Compliance', [
              { label: 'Code', value: (r: { employeeCode: string }) => r.employeeCode },
              { label: 'Employee', value: (r: { employeeName: string }) => r.employeeName },
              { label: 'Department', value: (r: { departmentName: string | null }) => r.departmentName },
              { label: 'Role', value: (r: { designationName: string | null }) => r.designationName },
              { label: 'Training', value: (r: { program: string }) => r.program },
              { label: 'Scheduled', value: (r: { scheduledDate: string | null }) => r.scheduledDate },
              { label: 'Nomination', value: (r: { nominationStatus: string }) => r.nominationStatus },
              { label: 'Compliance', value: (r: { compliance: string }) => r.compliance },
            ], rows)}
            className="rounded-lg px-4 py-2 text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            title="Print or save as PDF via the browser print dialog"
          >
            Print / PDF
          </button>
        </div>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Mandatory Items" value={kpis.total} tone="info" />
        <KPICard label="Compliant" value={kpis.compliant} tone="success" />
        <KPICard label="Overdue" value={kpis.overdue} tone="danger" />
        <KPICard label="Pending / Not Started" value={kpis.pending + kpis.notStarted} tone="warning" />
      </KPIGrid>

      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border bg-transparent px-3 py-2 text-sm">
        <option value="">All Statuses</option>
        {Object.keys(TONE).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={rows} loading={loading} emptyMessage="No mandatory training assignments." />
    </div>
  );
}
