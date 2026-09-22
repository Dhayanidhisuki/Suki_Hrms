const fs = require('fs');
const path = require('path');

const pages = [
  {
    dir: 'mentors', api: 'training-mentors', title: 'Mentors', singular: 'Mentor',
    iface: '{ id: number; name: string; role: string | null; expertise: string | null; email: string | null; phone: string | null; startDate: string | null; endDate: string | null; }',
    fields: [
      `{ name: 'name', label: 'Mentor Name', type: 'text', required: true }`,
      `{ name: 'employeeId', label: 'Employee ID (internal)', type: 'number' }`,
      `{ name: 'role', label: 'Mentor Role', type: 'select', options: [{ label: 'Buddy', value: 'Buddy' }, { label: 'Coach', value: 'Coach' }, { label: 'SME', value: 'SME' }] }`,
      `{ name: 'expertise', label: 'Expertise', type: 'text' }`,
      `{ name: 'email', label: 'Email', type: 'email' }`,
      `{ name: 'phone', label: 'Phone', type: 'text' }`,
      `{ name: 'startDate', label: 'Start Date', type: 'date' }`,
      `{ name: 'endDate', label: 'End Date', type: 'date' }`,
      `{ name: 'expectedOutcome', label: 'Expected Outcome', type: 'text' }`,
      `{ name: 'notes', label: 'Notes', type: 'textarea' }`,
    ],
    cols: [
      `{ key: 'name', label: 'Mentor', sortable: true }`,
      `{ key: 'role', label: 'Role', render: (r) => r.role ?? '—' }`,
      `{ key: 'expertise', label: 'Expertise', render: (r) => r.expertise ?? '—' }`,
      `{ key: 'email', label: 'Email', render: (r) => r.email ?? '—' }`,
      `{ key: 'endDate', label: 'Active Until', render: (r) => (r.endDate ? r.endDate.slice(0, 10) : '—') }`,
    ],
    init: `name: row.name, role: row.role ?? '', expertise: row.expertise ?? '', email: row.email ?? '', phone: row.phone ?? '', startDate: row.startDate ? row.startDate.slice(0, 10) : '', endDate: row.endDate ? row.endDate.slice(0, 10) : ''`,
    kpis: [
      { l: 'Mentors', v: 'records.length', t: 'info' },
      { l: 'Active', v: 'records.filter((r) => !r.endDate || new Date(r.endDate) >= new Date()).length', t: 'success' },
    ],
  },
  {
    dir: 'resources', api: 'training-resources', title: 'Training Resources', singular: 'Resource',
    iface: '{ id: number; name: string; resourceType: string | null; quantity: number; status: string; venueId: number | null; serialNumber: string | null; }',
    fields: [
      `{ name: 'name', label: 'Resource Name', type: 'text', required: true }`,
      `{ name: 'resourceType', label: 'Type', type: 'select', options: [{ label: 'Projector', value: 'PROJECTOR' }, { label: 'Laptop', value: 'LAPTOP' }, { label: 'Camera', value: 'CAMERA' }, { label: 'Microphone', value: 'MIC' }, { label: 'Lab Equipment', value: 'LAB' }, { label: 'Software License', value: 'SOFTWARE' }, { label: 'Other', value: 'OTHER' }] }`,
      `{ name: 'venueId', label: 'Venue ID', type: 'number' }`,
      `{ name: 'serialNumber', label: 'Serial / License No.', type: 'text' }`,
      `{ name: 'quantity', label: 'Quantity', type: 'number', defaultValue: 1 }`,
      `{ name: 'status', label: 'Status', type: 'select', options: [{ label: 'Available', value: 'AVAILABLE' }, { label: 'Booked', value: 'BOOKED' }, { label: 'Maintenance', value: 'MAINTENANCE' }, { label: 'Retired', value: 'RETIRED' }] }`,
      `{ name: 'notes', label: 'Notes', type: 'textarea' }`,
    ],
    cols: [
      `{ key: 'name', label: 'Resource', sortable: true }`,
      `{ key: 'resourceType', label: 'Type', render: (r) => r.resourceType ?? '—' }`,
      `{ key: 'quantity', label: 'Qty' }`,
      `{ key: 'status', label: 'Status', render: (r) => r.status }`,
      `{ key: 'serialNumber', label: 'Serial', render: (r) => r.serialNumber ?? '—' }`,
    ],
    init: `name: row.name, resourceType: row.resourceType ?? '', venueId: row.venueId ?? '', serialNumber: row.serialNumber ?? '', quantity: row.quantity, status: row.status`,
    kpis: [
      { l: 'Resources', v: 'records.length', t: 'info' },
      { l: 'Available', v: 'records.filter((r) => r.status === "AVAILABLE").length', t: 'success' },
      { l: 'Booked', v: 'records.filter((r) => r.status === "BOOKED").length', t: 'warning' },
    ],
  },
  {
    dir: 'providers', api: 'training-providers', title: 'Training Providers', singular: 'Provider',
    iface: '{ id: number; name: string; contactName: string | null; email: string | null; phone: string | null; categories: string | null; rating: string | number | null; }',
    fields: [
      `{ name: 'name', label: 'Provider Name', type: 'text', required: true }`,
      `{ name: 'contactName', label: 'Contact Person', type: 'text' }`,
      `{ name: 'email', label: 'Email', type: 'email' }`,
      `{ name: 'phone', label: 'Phone', type: 'text' }`,
      `{ name: 'website', label: 'Website', type: 'text' }`,
      `{ name: 'categories', label: 'Categories Offered', type: 'text' }`,
      `{ name: 'rating', label: 'Rating (0-5)', type: 'number' }`,
      `{ name: 'address', label: 'Address', type: 'textarea' }`,
      `{ name: 'notes', label: 'Notes', type: 'textarea' }`,
    ],
    cols: [
      `{ key: 'name', label: 'Provider', sortable: true }`,
      `{ key: 'contactName', label: 'Contact', render: (r) => r.contactName ?? '—' }`,
      `{ key: 'email', label: 'Email', render: (r) => r.email ?? '—' }`,
      `{ key: 'categories', label: 'Categories', render: (r) => r.categories ?? '—' }`,
      `{ key: 'rating', label: 'Rating', render: (r) => (r.rating != null ? Number(r.rating).toFixed(1) : '—') }`,
    ],
    init: `name: row.name, contactName: row.contactName ?? '', email: row.email ?? '', phone: row.phone ?? '', categories: row.categories ?? '', rating: row.rating != null ? Number(row.rating) : ''`,
    kpis: [
      { l: 'Providers', v: 'records.length', t: 'info' },
      { l: 'Rated 4+', v: 'records.filter((r) => Number(r.rating) >= 4).length', t: 'success' },
    ],
  },
  {
    dir: 'certifications', api: 'certification-masters', title: 'Certification Types', singular: 'Certification',
    iface: '{ id: number; name: string; issuingBody: string | null; validityMonths: number | null; category: string | null; isMandatory: boolean; }',
    fields: [
      `{ name: 'name', label: 'Certification Name', type: 'text', required: true }`,
      `{ name: 'issuingBody', label: 'Issuing Body', type: 'text' }`,
      `{ name: 'validityMonths', label: 'Validity (months)', type: 'number' }`,
      `{ name: 'category', label: 'Category', type: 'text' }`,
      `{ name: 'isMandatory', label: 'Mandatory', type: 'checkbox' }`,
      `{ name: 'description', label: 'Description', type: 'textarea' }`,
    ],
    cols: [
      `{ key: 'name', label: 'Certification', sortable: true }`,
      `{ key: 'issuingBody', label: 'Issuing Body', render: (r) => r.issuingBody ?? '—' }`,
      `{ key: 'validityMonths', label: 'Validity', render: (r) => (r.validityMonths ? r.validityMonths + ' mo' : '—') }`,
      `{ key: 'category', label: 'Category', render: (r) => r.category ?? '—' }`,
      `{ key: 'isMandatory', label: 'Mandatory', render: (r) => (r.isMandatory ? 'Yes' : 'No') }`,
    ],
    init: `name: row.name, issuingBody: row.issuingBody ?? '', validityMonths: row.validityMonths ?? '', category: row.category ?? '', isMandatory: row.isMandatory`,
    kpis: [
      { l: 'Certifications', v: 'records.length', t: 'info' },
      { l: 'Mandatory', v: 'records.filter((r) => r.isMandatory).length', t: 'warning' },
    ],
  },
];

const tpl = (p) => `'use client';

import { useState, useEffect } from 'react';
import { DataTable, FormModal, ConfirmDialog, KPICard, KPIGrid } from '@/components/ui';
import type { Column, FieldDef } from '@/components/ui';

interface ${p.singular} ${p.iface}

const fields: FieldDef[] = [
  ${p.fields.join(',\n  ')},
];

export default function ${p.singular}sPage() {
  const [records, setRecords] = useState<${p.singular}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, string | number | boolean | undefined>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/${p.api}');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (mounted) setRecords(Array.isArray(json) ? json : json.data ?? []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [refresh]);

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const url = editingId ? \`/api/${p.api}/\${editingId}\` : '/api/${p.api}';
    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(\`/api/${p.api}/\${id}\`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error ?? 'Delete failed'); return; }
    setRefresh((n) => n + 1);
  };

  const columns: Column<${p.singular}>[] = [
    ${p.cols.join(',\n    ')},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>${p.title}</h1>
        <button onClick={() => { setEditingId(null); setInitialValues({}); setModalOpen(true); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
          + Add ${p.singular}
        </button>
      </div>

      <KPIGrid columns={${p.kpis.length}}>
        ${p.kpis.map((k) => `<KPICard label="${k.l}" value={${k.v}} tone="${k.t}" />`).join('\n        ')}
      </KPIGrid>

      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}

      <DataTable columns={columns} data={records} loading={loading} onEdit={(row) => {
        setEditingId(row.id);
        setInitialValues({ ${p.init} });
        setModalOpen(true);
      }} onDelete={(row) => setDeleteId(row.id)} />

      <FormModal
        title={editingId ? 'Edit ${p.singular}' : 'Add ${p.singular}'}
        fields={fields}
        initialValues={initialValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Create'}
      />

      <ConfirmDialog
        title="Delete ${p.singular}"
        message="Are you sure?"
        isOpen={deleteId !== null}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
`;

for (const p of pages) {
  const dir = path.join('src/app/learning', p.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.tsx'), tpl(p));
  console.log('wrote', dir);
}
