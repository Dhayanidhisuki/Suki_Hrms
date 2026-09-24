/**
 * Offer Approval — BRD §5.15, §16.3.3.
 * Lists OfferLetters in 'Sent' status awaiting candidate response,
 * and 'Accepted'/'Rejected' offers for HR review/confirmation.
 * HR can mark an accepted offer as 'Confirmed' to enable joining.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable, useToast, type Column } from '@/components/ui';

interface OfferRow {
  id: number;
  offerNo: string;
  candidate: { id: number; applicationNo: string; firstName: string; lastName: string };
  status: string;
  proposedSalary: number | null;
  ctc: number | null;
  joiningDate: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  remarks: string | null;
}

export default function OfferApprovalPage() {
  const [records, setRecords] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/offer-letters');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: OfferRow[] } = await res.json();
      // Show offers that need HR attention: Sent (awaiting candidate) and Accepted (needs confirmation)
      setRecords(json.data.filter((r) => ['Sent', 'Accepted', 'Rejected', 'Expired'].includes(r.status)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (id: number, status: string) => {
    const res = await fetch(`/api/recruitment/offer-letters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Update failed');
      return;
    }
    fetchData();
    toast.success(`Offer marked as ${status}.`);
  };

  const columns: Column<OfferRow>[] = [
    { key: 'offerNo', label: 'Offer No' },
    { key: 'candidate', label: 'Candidate', render: (r) => `${r.candidate.applicationNo} — ${r.candidate.firstName} ${r.candidate.lastName}` },
    { key: 'status', label: 'Status', render: (r) => <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: r.status === 'Accepted' ? '#dcfce7' : r.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: r.status === 'Accepted' ? '#166534' : r.status === 'Rejected' ? '#991b1b' : '#92400e' }}>{r.status}</span> },
    { key: 'proposedSalary', label: 'Proposed CTC', render: (r) => (r.proposedSalary ? `₹${r.proposedSalary.toLocaleString()}` : '—') },
    { key: 'joiningDate', label: 'Joining Date', render: (r) => (r.joiningDate ? new Date(r.joiningDate).toLocaleDateString() : '—') },
    { key: 'sentAt', label: 'Sent At', render: (r) => (r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Offer Approval</h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Offers awaiting candidate response and accepted offers pending HR confirmation (BRD §5.15).</p>
      </div>

      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        emptyMessage="No offers pending review."
        renderRowActions={(row) => (
          <>
            {row.status === 'Accepted' && (
              <button onClick={() => updateStatus(row.id, 'Closed')} className="mr-3 text-xs font-medium hover:underline" style={{ color: '#166534' }}>Close & Enable Joining</button>
            )}
            {row.status === 'Sent' && (
              <button onClick={() => updateStatus(row.id, 'Expired')} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Mark Expired</button>
            )}
          </>
        )}
      />
    </div>
  );
}
