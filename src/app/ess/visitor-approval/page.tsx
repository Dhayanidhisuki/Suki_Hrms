/**
 * Employee Self Service — Visitor Pass Approval. Approve or reject visitor
 * requests where the logged-in employee is the person to meet.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { useToast, useConfirm } from '@/components/ui';

interface VisitorPass {
  id: number;
  gatePassNo: string;
  visitorName: string;
  mobileNo: string;
  visitorTypeValue: string;
  purposeValue: string;
  visitDate: string;
  validFrom: string;
  validTo: string;
  status: string;
  createdAt: string;
  rejectionReason?: string | null;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PENDING_APPROVAL: { bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  COMPLETED: { bg: '#f1f5f9', fg: '#475569' },
};

export default function VisitorApprovalPage() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fetchPasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workforce/my-visitor-approvals');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to load visitor passes');
      }
      const json = await res.json();
      setPasses(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load visitor passes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPasses();
  }, [fetchPasses]);

  const handleApprove = async (passId: number) => {
    if (
      !(await confirm({
        title: 'Approve visitor pass?',
        message: 'The visitor will be cleared for entry.',
        confirmLabel: 'Approve',
      }))
    )
      return;
    setApproving(true);
    try {
      const res = await fetch(`/api/visitor/gate-passes/${passId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to approve');
      }
      fetchPasses();
      toast.success('Visitor pass approved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (passId: number) => {
    if (!rejectReason.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/visitor/gate-passes/${passId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to reject');
      }
      setRejectingId(null);
      setRejectReason('');
      fetchPasses();
      toast.success('Visitor pass rejected.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Visitor Pass Approvals
        </h1>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Approve or reject visitor requests to meet you.
        </p>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading…
        </div>
      ) : passes.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--border)' }}>
          <p style={{ color: 'var(--foreground-muted)' }}>No pending visitor pass approvals.</p>
        </div>
      ) : (
        <div className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                <th className="px-4 py-2">Pass No.</th>
                <th className="px-4 py-2">Visitor Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Purpose</th>
                <th className="px-4 py-2">Visit Date</th>
                <th className="px-4 py-2">Valid From - To</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {passes.map((pass) => (
                <tr key={pass.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2 font-medium">{pass.gatePassNo}</td>
                  <td className="px-4 py-2">
                    <div>{pass.visitorName}</div>
                    <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {pass.mobileNo}
                    </div>
                  </td>
                  <td className="px-4 py-2">{pass.visitorTypeValue}</td>
                  <td className="px-4 py-2">{pass.purposeValue}</td>
                  <td className="px-4 py-2">{new Date(pass.visitDate).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {new Date(pass.validFrom).toLocaleDateString('en-IN', { timeZone: 'UTC' })} —{' '}
                    {new Date(pass.validTo).toLocaleDateString('en-IN', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleApprove(pass.id)}
                      disabled={approving}
                      className="mr-3 text-xs font-medium hover:underline disabled:opacity-50"
                      style={{ color: '#166534' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(pass.id)}
                      disabled={rejecting}
                      className="text-xs font-medium hover:underline disabled:opacity-50"
                      style={{ color: '#991b1b' }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingId && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setRejectingId(null)}
          style={{ zIndex: 50 }}
        >
          <div
            className="w-full max-w-md rounded-lg border p-6 space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Reject Visitor Pass
            </h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a rejection reason..."
              className="w-full rounded-lg border p-3 text-sm resize-none"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}
              >
                {rejecting ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
