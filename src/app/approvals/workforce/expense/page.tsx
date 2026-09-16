'use client';

import { useState, useEffect } from 'react';

interface ExpenseItem {
  id: number;
  category: string;
  description: string;
  amount: number;
  receiptDate: string;
}

interface ExpenseClaim {
  id: number;
  employeeId: number;
  purpose: string;
  description?: string;
  totalAmount: number;
  approvedAmount?: number;
  status: string;
  submissionDate: string;
  items: ExpenseItem[];
}

function getStatusColor(status: string) {
  switch (status) {
    case 'APPROVED':
      return '#10b981';
    case 'SUBMITTED':
      return '#f59e0b';
    case 'REJECTED':
      return '#ef4444';
    case 'PAID':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
}

export default function ExpenseApprovalPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/workforce/expense-reimbursement?status=SUBMITTED');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load expense claims');
        }
        const data = await res.json();
        setClaims(data.data?.filter((c: ExpenseClaim) => c.status === 'SUBMITTED') ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load expense claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  const selectedClaim = claims.find((c) => c.id === selectedId);

  const handleApprove = async () => {
    if (!selectedClaim) return;
    if (!approvedAmount || isNaN(parseFloat(approvedAmount))) {
      setError('Enter a valid approved amount');
      return;
    }

    const amount = parseFloat(approvedAmount);
    if (amount > selectedClaim.totalAmount) {
      setError('Approved amount cannot exceed claimed amount');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/workforce/expense-reimbursement/${selectedClaim.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedAmount: amount }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to approve expense claim');
      }

      setClaims(claims.filter((c) => c.id !== selectedClaim.id));
      setSelectedId(null);
      setApprovedAmount('');
      setActionType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve expense claim');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim) return;
    if (!rejectionReason.trim()) {
      setError('Enter a rejection reason');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/workforce/expense-reimbursement/${selectedClaim.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to reject expense claim');
      }

      setClaims(claims.filter((c) => c.id !== selectedClaim.id));
      setSelectedId(null);
      setRejectionReason('');
      setActionType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject expense claim');
    } finally {
      setActionLoading(false);
    }
  };

  if (selectedId && selectedClaim) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setSelectedId(null);
            setActionType(null);
            setApprovedAmount('');
            setRejectionReason('');
            setError(null);
          }}
          className="text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          ← Back to Pending Claims
        </button>

        <div className="rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Expense Reimbursement Approval
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Purpose
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {selectedClaim.purpose}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Claimed Amount
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                ₹{selectedClaim.totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Submitted On
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {new Date(selectedClaim.submissionDate).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                Items Count
              </div>
              <div className="mt-1 font-semibold" style={{ color: 'var(--foreground)' }}>
                {selectedClaim.items.length}
              </div>
            </div>
          </div>

          {selectedClaim.description && (
            <div className="mb-6 rounded-lg p-3" style={{ backgroundColor: 'var(--surface)' }}>
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Description
              </div>
              <div className="mt-1" style={{ color: 'var(--foreground-muted)' }}>
                {selectedClaim.description}
              </div>
            </div>
          )}

          <div className="mb-6 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--foreground)' }}>
              Expense Items
            </h3>
            <div className="space-y-2 text-sm">
              {selectedClaim.items.map((item) => (
                <div key={item.id} className="flex justify-between p-2 rounded" style={{ backgroundColor: 'var(--surface)' }}>
                  <div>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {item.category}
                    </span>
                    <span className="ml-2" style={{ color: 'var(--foreground-muted)' }}>
                      - {item.description}
                    </span>
                  </div>
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    ₹{item.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {actionType === 'approve' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Approved Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedClaim.totalAmount}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  placeholder={`Up to ₹${selectedClaim.totalAmount}`}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    color: 'white',
                    opacity: actionLoading ? 0.5 : 1,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => setActionType(null)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : actionType === 'reject' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this expense claim is being rejected..."
                  maxLength={500}
                  rows={4}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    opacity: actionLoading ? 0.5 : 1,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => setActionType(null)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActionType('approve');
                  setApprovedAmount(selectedClaim.totalAmount.toString());
                }}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: '#10b981',
                  backgroundColor: '#10b981',
                  color: 'white',
                }}
              >
                ✓ Approve
              </button>
              <button
                onClick={() => setActionType('reject')}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: '#ef4444',
                  backgroundColor: '#ef4444',
                  color: 'white',
                }}
              >
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Expense Reimbursement Approvals
      </h1>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading…
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No pending expense claims to approve.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              onClick={() => setSelectedId(claim.id)}
              className="cursor-pointer rounded-lg border p-4 transition hover:border-blue-400"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {claim.purpose}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {claim.items.length} items • Submitted {new Date(claim.submissionDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                    ₹{claim.totalAmount.toLocaleString('en-IN')}
                  </div>
                  <span
                    className="mt-1 inline-block rounded px-2 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: getStatusColor(claim.status) }}
                  >
                    {claim.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
