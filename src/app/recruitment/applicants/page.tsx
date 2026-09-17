'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, DataTable, FormModal, PageHeader, type Column, type FieldDef } from '@/components/ui';

type Applicant = {
  id: number;
  applicationNo: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  status: string;
  applicantDate: string;
};

const PIPELINE = ['REGISTERED', 'SCREENING', 'INTERVIEW', 'DOC_VERIFICATION', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED'];

export default function ApplicantsPage() {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await fetch(`/api/recruitment/applicants?${params}`);
    if (res.ok) setRows((await res.json()).data ?? []);
  }, [status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields: FieldDef[] = [
    { name: 'firstName', label: 'First name', type: 'text', required: true },
    { name: 'lastName', label: 'Last name', type: 'text', required: true },
    { name: 'mobile', label: 'Mobile', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'text', required: true },
    { name: 'source', label: 'Source / reference', type: 'text' },
  ];

  const columns: Column<Applicant>[] = [
    { key: 'applicationNo', label: 'App no', className: 'font-medium' },
    { key: 'name', label: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Stage' },
    {
      key: 'open',
      label: '',
      render: (r) => (
        <Link href={`/recruitment/applicants/${r.id}`} style={{ color: 'var(--accent)' }}>
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Recruitment"
        title="Applicants"
        description="Registration, pipeline, document verification. After join, files move to the employee Document Module."
        actions={
          <Button type="button" variant="primary" onClick={() => setOpen(true)}>
            New applicant
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Search name, mobile, app no" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All stages</option>
          {PIPELINE.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} data={rows} emptyMessage="No applicants yet." />
      <FormModal
        isOpen={open}
        title="Register applicant"
        fields={fields}
        onClose={() => setOpen(false)}
        onSubmit={async (values) => {
          const res = await fetch('/api/recruitment/applicants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error ?? 'Create failed');
          setOpen(false);
          await load();
        }}
      />
    </div>
  );
}
