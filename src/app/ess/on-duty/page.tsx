/**
 * Employee Self Service — On-Duty (OD) Applications. Self-service like
 * Permission Requests: always the logged-in user's own employee record,
 * resolved server-side. Two-stage approval (Reporting Manager → HR).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, FormModal, Button, PageBreadcrumb, useToast, type Column, type FieldDef } from '@/components/ui';

interface OnDutyRow {
  id: number;
  fromDate: string;
  toDate: string;
  location: string;
  purpose: string;
  customerProject: string | null;
  remarks: string | null;
  status: string;
  managerRejectionReason: string | null;
  rejectionReason: string | null;
  durationType: string | null;
  latitude: number | null;
  longitude: number | null;
}

const DURATION_LABEL: Record<string, string> = {
  full_day: 'Full Day',
  half_day: 'Half Day',
  '3_hours': '3 Hours',
  '4_hours': '4 Hours',
};

// Best-effort, one-shot — captured at the moment of submit as a location
// reference for the request, not a check-in/check-out pair. Never blocks
// submission: browsers routinely deny/timeout this (no permission, no GPS
// fix indoors), and On-Duty requests need to go through regardless.
function captureLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending_manager: { bg: '#fef9c3', fg: '#854d0e' },
  pending_hr: { bg: '#dbeafe', fg: '#1e40af' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
};

const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function OnDutyPage() {
  const [records, setRecords] = useState<OnDutyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formDurationType, setFormDurationType] = useState('full_day');
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/on-duty?scope=mine');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: OnDutyRow[] } = await res.json();
      setRecords(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const fields: FieldDef[] = [
    { name: 'fromDate', label: 'From Date', type: 'date', required: true },
    { name: 'toDate', label: 'To Date', type: 'date', required: true },
    {
      name: 'durationType',
      label: 'Duration',
      type: 'select',
      required: true,
      defaultValue: 'full_day',
      options: [
        { value: 'full_day', label: 'Full Day' },
        { value: 'half_day', label: 'Half Day' },
        { value: '3_hours', label: '3 Hours' },
        { value: '4_hours', label: '4 Hours' },
      ],
    },
    { name: 'location', label: 'Location', type: 'text', required: true },
    { name: 'purpose', label: 'Purpose', type: 'textarea', required: true },
    { name: 'customerProject', label: 'Customer / Project', type: 'text' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, string | number | boolean>) => {
    const location = await captureLocation();
    const res = await fetch('/api/workforce/on-duty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate: values.fromDate,
        toDate: values.toDate,
        durationType: values.durationType || 'full_day',
        location: values.location,
        purpose: values.purpose,
        customerProject: values.customerProject || null,
        remarks: values.remarks || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Save failed');
    }
    fetchData();
    toast.success(
      location
        ? 'On-duty request submitted successfully with your current location.'
        : 'On-duty request submitted successfully. (Location was not available — you can still proceed.)'
    );
  };

  const columns: Column<OnDutyRow>[] = [
    { key: 'fromDate', label: 'From', render: (r) => new Date(r.fromDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'toDate', label: 'To', render: (r) => new Date(r.toDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) },
    { key: 'durationType', label: 'Duration', render: (r) => DURATION_LABEL[r.durationType ?? 'full_day'] ?? 'Full Day' },
    { key: 'location', label: 'Location' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'customerProject', label: 'Customer/Project', render: (r) => r.customerProject ?? '—' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const tone = STATUS_TONE[r.status] ?? { bg: '#f3f4f6', fg: '#4b5563' };
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: tone.bg, color: tone.fg }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        );
      },
    },
    {
      key: 'remarks',
      label: 'Notes',
      render: (r) => r.rejectionReason ?? r.managerRejectionReason ?? r.remarks ?? '—',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <PageBreadcrumb items={[{ label: 'Dashboard', href: '/ess/dashboard' }, { label: 'On-Duty Requests' }]} />
        <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>On-Duty Requests</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Apply when performing official duty outside your normal workplace. Approved days are counted as present, not absent.
        </p>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-main)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          <Button
            variant="primary"
            onClick={() => {
              setFormDurationType('full_day');
              setModalOpen(true);
            }}
          >
            Submit Request
          </Button>
        </div>

        <DataTable variant="card" columns={columns} data={records} loading={loading} emptyMessage="No On-Duty applications yet." />
      </div>

      <FormModal
        title="Apply for On-Duty"
        fields={fields}
        initialValues={{}}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Application"
        onFieldChange={(name, value) => {
          if (name === 'durationType') setFormDurationType(String(value));
        }}
      >
        {formDurationType !== 'full_day' && (
          <div className="text-xs" style={{ color: '#854d0e' }}>
            A {DURATION_LABEL[formDurationType] ?? formDurationType} On-Duty should be confirmed with your reporting manager before applying.
          </div>
        )}
      </FormModal>
    </div>
  );
}
