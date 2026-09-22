'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, DataTable, PageHeader, SectionCard, StatusBadge, type Column, useConfirm } from '@/components/ui';
import { FNF_STATUS_TONE } from '@/lib/fnf/workflow';
import { formatInr } from '@/lib/fnf/presentation';

type Row = {
  id: number;
  status: string;
  netPayable: string | number;
  lastWorkingDay: string;
  employee: { employeeCode: string; firstName: string; lastName: string };
};

function useQueue(queue: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/fnf?queue=${queue}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const json = await res.json();
      setRows(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, load };
}

export default function FnFApprovalPage() {
  const { prompt } = useConfirm();
  const manager = useQueue('manager');
  const hr = useQueue('hr');
  const finance = useQueue('finance');
  const [banner, setBanner] = useState<string | null>(null);

  const act = async (url: string, body?: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBanner(j.error ?? 'Action failed');
      return;
    }
    setBanner(null);
    await Promise.all([manager.load(), hr.load(), finance.load()]);
  };

  const columns: Column<Row>[] = [
    { key: 'code', label: 'Code', render: (r) => r.employee.employeeCode, className: 'font-medium' },
    { key: 'name', label: 'Name', render: (r) => `${r.employee.firstName} ${r.employee.lastName}`.trim() },
    { key: 'lastWorkingDay', label: 'LWD', render: (r) => String(r.lastWorkingDay).slice(0, 10) },
    { key: 'netPayable', label: 'Net', render: (r) => formatInr(r.netPayable) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge tone={FNF_STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</StatusBadge>,
    },
  ];

  const actions = (row: Row, kind: 'manager' | 'hr' | 'finance') => (
    <div className="flex flex-wrap gap-1">
      {kind === 'manager' && (
        <Button size="xs" onClick={() => act(`/api/payroll/fnf/${row.id}/manager-approve`)}>
          Approve
        </Button>
      )}
      {kind === 'hr' && (
        <Button size="xs" variant="success" onClick={() => act(`/api/payroll/fnf/${row.id}/approve`)}>
          Approve
        </Button>
      )}
      {kind === 'finance' && (
        <Button size="xs" variant="success" onClick={() => act(`/api/payroll/fnf/${row.id}/finance-verify`)}>
          Verify
        </Button>
      )}
      <Button
        size="xs"
        variant="danger"
        onClick={async () => {
          const reason = await prompt({
            title: 'Reject this settlement?',
            message: 'A rejection reason is recorded against the request.',
            placeholder: 'Rejection reason',
            required: true,
            multiline: true,
          });
          if (!reason) return;
          void act(`/api/payroll/fnf/${row.id}/reject`, { rejectionReason: reason });
        }}
      >
        Reject
      </Button>
      <a href={`/payroll/processing/full-and-final?open=${row.id}`} className="px-2 py-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
        Open
      </a>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Full & Final settlement"
        description="Manager (if configured) → HR → Finance. Open a row to view the KUN statement and PDF."
      />
      {banner && <Alert tone="danger">{banner}</Alert>}
      {manager.error && <Alert tone="danger">{manager.error}</Alert>}
      <SectionCard title={`Pending manager (${manager.rows.length})`}>
        <DataTable
          data={manager.rows}
          columns={columns}
          loading={manager.loading}
          emptyMessage="No F&F waiting on reporting manager."
          renderRowActions={(r) => actions(r, 'manager')}
        />
      </SectionCard>
      <SectionCard title={`Pending HR (${hr.rows.length})`}>
        <DataTable
          data={hr.rows}
          columns={columns}
          loading={hr.loading}
          emptyMessage="No F&F submitted to HR."
          renderRowActions={(r) => actions(r, 'hr')}
        />
      </SectionCard>
      <SectionCard title={`Pending finance (${finance.rows.length})`}>
        <DataTable
          data={finance.rows}
          columns={columns}
          loading={finance.loading}
          emptyMessage="No F&F waiting on finance verify."
          renderRowActions={(r) => actions(r, 'finance')}
        />
      </SectionCard>
    </div>
  );
}
