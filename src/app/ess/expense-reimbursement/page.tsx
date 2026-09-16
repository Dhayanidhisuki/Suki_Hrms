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
  purpose: string;
  totalAmount: number;
  status: string;
  submissionDate: string;
  items: ExpenseItem[];
}

const EXPENSE_CATEGORIES = ['MEALS', 'TRANSPORT', 'ACCOMMODATION', 'OFFICE_SUPPLIES', 'OTHERS'];

function getStatusColor(status: string) {
  switch (status) {
    case 'APPROVED':
      return '#10b981';
    case 'SUBMITTED':
    case 'PENDING_APPROVAL':
      return '#f59e0b';
    case 'REJECTED':
      return '#ef4444';
    case 'PAID':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
}

export default function ExpenseReimbursementPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<Array<{ category: string; description: string; amount: string; receiptDate: string }>>([
    { category: 'MEALS', description: '', amount: '', receiptDate: new Date().toISOString().split('T')[0] },
  ]);
  const [purpose, setPurpose] = useState('BUSINESS_MEALS');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/workforce/expense-reimbursement');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load expense claims');
        }
        const data = await res.json();
        setClaims(data.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load expense claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { category: 'MEALS', description: '', amount: '', receiptDate: new Date().toISOString().split('T')[0] },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setError('Add at least one expense item');
      return;
    }

    const parsedItems = items.map((item) => ({
      ...item,
      amount: parseFloat(item.amount),
    }));

    if (parsedItems.some((item) => !item.description || !item.amount || isNaN(item.amount))) {
      setError('Fill in all required fields for each item');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/workforce/expense-reimbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          description: description || undefined,
          items: parsedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to submit expense claim');
      }

      const newClaim = await res.json();
      setClaims([newClaim, ...claims]);
      setShowForm(false);
      setItems([{ category: 'MEALS', description: '', amount: '', receiptDate: new Date().toISOString().split('T')[0] }]);
      setPurpose('BUSINESS_MEALS');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit expense claim');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          My Expense Reimbursement
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
          {showForm ? 'Cancel' : '+ New Claim'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            Submit Expense Reimbursement Claim
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Purpose *
              </label>
              <select
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              >
                <option value="BUSINESS_MEALS">Business Meals</option>
                <option value="TRAVEL">Travel</option>
                <option value="ACCOMMODATION">Accommodation</option>
                <option value="CLIENT_VISIT">Client Visit</option>
                <option value="TRAINING">Training</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Client meeting at..."
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <h3 className="mb-4 font-semibold" style={{ color: 'var(--foreground)' }}>
              Expense Items
            </h3>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-5" style={{ borderColor: 'var(--border)' }}>
                  <select
                    value={item.category}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].category = e.target.value;
                      setItems(newItems);
                    }}
                    className="rounded border px-2 py-1 text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--foreground)', color: 'var(--surface)' }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].description = e.target.value;
                      setItems(newItems);
                    }}
                    placeholder="Description"
                    className="rounded border px-2 py-1 text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--foreground)', color: 'var(--surface)' }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].amount = e.target.value;
                      setItems(newItems);
                    }}
                    placeholder="Amount"
                    className="rounded border px-2 py-1 text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--foreground)', color: 'var(--surface)' }}
                  />

                  <input
                    type="date"
                    value={item.receiptDate}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].receiptDate = e.target.value;
                      setItems(newItems);
                    }}
                    className="rounded border px-2 py-1 text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--foreground)', color: 'var(--surface)' }}
                  />

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="mt-3 rounded border px-3 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              + Add Item
            </button>
          </div>

          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--foreground-muted)' }}>Total Amount:</span>
              <span className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--primary)',
                color: 'white',
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Claim'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Your expense claim will be reviewed by your manager. Keep receipts for verification. Approved claims will be reimbursed to your registered bank account.
          </p>
        </form>
      )}

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
          No expense claims submitted yet. Submit one to request reimbursement.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div key={claim.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {claim.purpose}
                    </h3>
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: getStatusColor(claim.status) }}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {claim.items.length} items • {new Date(claim.submissionDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                    ₹{claim.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <div>Items:</div>
                  <ul className="mt-1 space-y-1">
                    {claim.items.map((item) => (
                      <li key={item.id} className="ml-2">
                        • {item.category} - {item.description} (₹{item.amount.toLocaleString('en-IN')})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
