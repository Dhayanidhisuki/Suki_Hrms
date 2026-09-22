'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui';

interface ShiftChangeRequest {
  id: number;
  requestedDate: string;
  currentShiftMaster: { code: string; name: string };
  requestedShiftMaster: { code: string; name: string; startTime: string; endTime: string };
  status: string;
  reason?: string;
  createdAt: string;
}

function formatTime(time: string) {
  if (!time) return 'N/A';
  return time.substring(0, 5);
}

function getStatusColor(status: string) {
  switch (status) {
    case 'approved':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'rejected':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

export default function ShiftChangePage() {
  const toast = useToast();
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/workforce/shift-change-request?scope=my');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load shift change requests');
        }
        const data = await res.json();
        setRequests(data.data ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          My Shift Change Requests
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--primary)',
            color: 'white',
          }}
        >
          {showForm ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="mb-4 font-semibold" style={{ color: 'var(--foreground)' }}>
            Request Shift Change
          </h2>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Feature coming soon. Contact HR to request a shift change.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          {showForm ? 'Create your first shift change request' : 'No shift change requests yet. Create one to change your work shift.'}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {new Date(req.requestedDate).toLocaleDateString('en-IN')}
                    </h3>
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: getStatusColor(req.status) }}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>
                  {req.reason && (
                    <p className="mt-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                      {req.reason}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)' }}>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Current Shift
                  </div>
                  <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                    {req.currentShiftMaster.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {formatTime(req.currentShiftMaster.name)}
                  </div>
                </div>

                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)' }}>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Requested Shift
                  </div>
                  <div className="mt-1 font-semibold" style={{ color: 'var(--primary)' }}>
                    {req.requestedShiftMaster.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {formatTime(req.requestedShiftMaster.startTime)} - {formatTime(req.requestedShiftMaster.endTime)}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Requested on {new Date(req.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
