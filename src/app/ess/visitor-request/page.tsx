'use client';

import { useState, useEffect } from 'react';

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
}

function getStatusColor(status: string) {
  switch (status) {
    case 'APPROVED':
      return '#10b981';
    case 'PENDING_APPROVAL':
      return '#f59e0b';
    case 'REJECTED':
      return '#ef4444';
    case 'COMPLETED':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export default function VisitorPassRequestPage() {
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNo: '',
    email: '',
    address: '',
    visitorTypeValue: 'VENDOR',
    purposeValue: 'BUSINESS',
    visitDate: new Date().toISOString().split('T')[0],
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    qrValidHours: 24,
    noOfPersons: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPasses = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/workforce/visitor-pass-request');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to load visitor passes');
        }
        const data = await res.json();
        setPasses(data.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load visitor passes');
      } finally {
        setLoading(false);
      }
    };

    fetchPasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/workforce/visitor-pass-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create visitor pass request');
      }
      const newPass = await res.json();
      setPasses([newPass, ...passes]);
      setShowForm(false);
      setFormData({
        visitorName: '',
        mobileNo: '',
        email: '',
        address: '',
        visitorTypeValue: 'VENDOR',
        purposeValue: 'BUSINESS',
        visitDate: new Date().toISOString().split('T')[0],
        validFrom: new Date().toISOString().split('T')[0],
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        qrValidHours: 24,
        noOfPersons: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visitor pass');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          My Visitor Pass Requests
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
          {showForm ? 'Cancel' : '+ Request Visitor Pass'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-6" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
            New Visitor Pass Request
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Visitor Name *
              </label>
              <input
                type="text"
                required
                value={formData.visitorName}
                onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={formData.mobileNo}
                onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value.replace(/\D/g, '') })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                placeholder="10-digit mobile number"
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Visit Date *
              </label>
              <input
                type="date"
                required
                value={formData.visitDate}
                onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Valid From *
              </label>
              <input
                type="date"
                required
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Valid To *
              </label>
              <input
                type="date"
                required
                value={formData.validTo}
                onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Number of Persons
              </label>
              <input
                type="number"
                min="1"
                value={formData.noOfPersons}
                onChange={(e) => setFormData({ ...formData, noOfPersons: parseInt(e.target.value) })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              />
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
              {submitting ? 'Submitting...' : 'Request Visitor Pass'}
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
            Your visitor pass request will be reviewed and approved by HR. Check back here for status updates.
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
      ) : passes.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
          No visitor pass requests yet. Request one to allow visitors access.
        </div>
      ) : (
        <div className="space-y-3">
          {passes.map((pass) => (
            <div key={pass.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {pass.visitorName}
                    </h3>
                    <span
                      className="inline-block rounded px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: getStatusColor(pass.status) }}
                    >
                      {formatStatus(pass.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    {pass.mobileNo} • {pass.gatePassNo}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Visit Date
                  </div>
                  <div className="mt-1" style={{ color: 'var(--foreground)' }}>
                    {new Date(pass.visitDate).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Type
                  </div>
                  <div className="mt-1" style={{ color: 'var(--foreground)' }}>
                    {pass.visitorTypeValue || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Purpose
                  </div>
                  <div className="mt-1" style={{ color: 'var(--foreground)' }}>
                    {pass.purposeValue || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase" style={{ color: 'var(--foreground-muted)' }}>
                    Requested
                  </div>
                  <div className="mt-1" style={{ color: 'var(--foreground)' }}>
                    {new Date(pass.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
