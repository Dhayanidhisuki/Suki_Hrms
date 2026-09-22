/**
 * Candidate Self-Service Portal (BRD §10.6).
 * Public page — token-based access, no login required.
 * URL: /portal?t=<token>
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { useToast } from '@/components/ui';

interface CandidateInfo {
  id: number;
  applicationNo: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  department: string | null;
  designation: string | null;
  currentStatus: { statusCode: string; statusName: string; stageCategory: string; color: string | null } | null;
}

interface ActivityEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
  remarks: string | null;
}

interface InterviewEntry {
  id: number;
  level: string;
  type: string;
  date: string;
  time: string;
  mode: string;
  status: string;
  interviewer: string;
  locationOrLink: string | null;
}

interface OfferEntry {
  id: number;
  offerNo: string;
  status: string;
  proposedSalary: number | null;
  ctc: number | null;
  joiningDate: string | null;
  employmentType: string | null;
}

interface JoiningInfo {
  id: number;
  joiningDate: string | null;
  joiningStatus: string;
  actualJoiningDate: string | null;
}

interface MessageEntry {
  id: number;
  fromRole: string;
  fromName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface DocumentEntry {
  id: number;
  fileName: string | null;
  fileUrl: string | null;
  status: string;
  remarks: string | null;
  documentType: { documentName: string } | null;
}

type Tab = 'status' | 'interviews' | 'offer' | 'joining' | 'documents' | 'messages';

const TABS: { key: Tab; label: string }[] = [
  { key: 'status', label: 'Application Status' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'offer', label: 'Offer Letter' },
  { key: 'joining', label: 'Joining' },
  { key: 'documents', label: 'Documents' },
  { key: 'messages', label: 'Message HR' },
];

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}>
      <PortalInner />
    </Suspense>
  );
}

function PortalInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [interviews, setInterviews] = useState<InterviewEntry[]>([]);
  const [offers, setOffers] = useState<OfferEntry[]>([]);
  const [joining, setJoining] = useState<JoiningInfo | null>(null);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newDoc, setNewDoc] = useState({ documentName: '', filePath: '', remarks: '' });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('No token provided. Please use the link sent to your email.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/portal?t=${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to load portal');
      }
      const data = await res.json();
      setCandidate(data.candidate);
      setActivity(data.activity);
      setInterviews(data.interviews);
      setOffers(data.offers);
      setJoining(data.joining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/portal/messages?t=${token}`);
    if (res.ok) {
      const json = await res.json();
      setMessages(json.data);
    }
  }, [token]);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/portal/documents?t=${token}`);
    if (res.ok) {
      const json = await res.json();
      setDocuments(json.data);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (activeTab === 'messages') fetchMessages(); }, [activeTab, fetchMessages]);
  useEffect(() => { if (activeTab === 'documents') fetchDocuments(); }, [activeTab, fetchDocuments]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/portal/messages?t=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to send');
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSendingMessage(false);
    }
  };

  const uploadDoc = async () => {
    if (!newDoc.documentName.trim()) return;
    setUploadingDoc(true);
    try {
      const res = await fetch(`/api/portal/documents?t=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: newDoc.documentName,
          filePath: newDoc.filePath || null,
          remarks: newDoc.remarks || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to upload');
      setNewDoc({ documentName: '', filePath: '', remarks: '' });
      fetchDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const offerAction = async (offerId: number, action: 'accept' | 'reject') => {
    if (action === 'reject' && !confirm('Are you sure you want to reject this offer?')) return;
    setActionLoading(offerId);
    try {
      const res = await fetch(`/api/portal/offer?t=${token}&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading your portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Portal Unavailable</h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{error}</p>
          <p className="text-xs mt-4" style={{ color: 'var(--foreground-muted)' }}>
            If your link has expired, please contact HR for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" plate />
              <h1 className="text-lg font-semibold">Candidate Portal</h1>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{candidate.applicationNo}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status banner */}
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase font-semibold" style={{ color: 'var(--foreground-muted)' }}>Current Status</p>
              <p className="text-base font-semibold mt-1">{candidate.currentStatus?.statusName ?? '—'}</p>
            </div>
            {candidate.currentStatus?.color && (
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: candidate.currentStatus.color, color: '#fff' }}>
                {candidate.currentStatus.stageCategory}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <p><span style={{ color: 'var(--foreground-muted)' }}>Department:</span> {candidate.department ?? '—'}</p>
            <p><span style={{ color: 'var(--foreground-muted)' }}>Designation:</span> {candidate.designation ?? '—'}</p>
            <p><span style={{ color: 'var(--foreground-muted)' }}>Email:</span> {candidate.email}</p>
            <p><span style={{ color: 'var(--foreground-muted)' }}>Mobile:</span> {candidate.mobile}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="px-3 py-2 text-sm font-medium transition-colors border-b-2"
              style={{
                color: activeTab === t.key ? 'var(--accent)' : 'var(--foreground-muted)',
                borderColor: activeTab === t.key ? 'var(--accent)' : 'transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Application History</h2>
            {activity.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{a.action}</span>
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                    {a.fromStatus && a.toStatus && (
                      <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{a.fromStatus} → {a.toStatus}</p>
                    )}
                    {a.remarks && <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{a.remarks}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'interviews' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Scheduled Interviews</h2>
            {interviews.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No interviews scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {interviews.map((i) => (
                  <div key={i.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{i.level} — {i.type}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: i.status === 'Completed' ? '#dcfce7' : i.status === 'Cancelled' ? '#fee2e2' : '#fef3c7', color: i.status === 'Completed' ? '#166534' : i.status === 'Cancelled' ? '#991b1b' : '#92400e' }}>{i.status}</span>
                    </div>
                    <div className="text-xs mt-2 space-y-1" style={{ color: 'var(--foreground-muted)' }}>
                      <p>Date: {new Date(i.date).toLocaleDateString()} at {i.time}</p>
                      <p>Mode: {i.mode} {i.locationOrLink ? `· ${i.locationOrLink}` : ''}</p>
                      <p>Interviewer: {i.interviewer}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'offer' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Offer Letters</h2>
            {offers.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No offers issued yet.</p>
            ) : (
              <div className="space-y-3">
                {offers.map((o) => (
                  <div key={o.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{o.offerNo}</p>
                        {o.ctc && <p className="text-sm mt-1">CTC: ₹{Number(o.ctc).toLocaleString()}</p>}
                        {o.proposedSalary && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Proposed: ₹{Number(o.proposedSalary).toLocaleString()}</p>}
                        {o.employmentType && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Type: {o.employmentType}</p>}
                        {o.joiningDate && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Joining Date: {new Date(o.joiningDate).toLocaleDateString()}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: o.status === 'Accepted' ? '#dcfce7' : o.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: o.status === 'Accepted' ? '#166534' : o.status === 'Rejected' ? '#991b1b' : '#92400e' }}>{o.status}</span>
                    </div>
                    {o.status === 'Sent' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => offerAction(o.id, 'accept')}
                          disabled={actionLoading === o.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                          style={{ backgroundColor: '#16a34a', opacity: actionLoading === o.id ? 0.6 : 1 }}
                        >
                          {actionLoading === o.id ? 'Processing...' : 'Accept Offer'}
                        </button>
                        <button
                          onClick={() => offerAction(o.id, 'reject')}
                          disabled={actionLoading === o.id}
                          className="px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ backgroundColor: '#fee2e2', color: '#991b1b', opacity: actionLoading === o.id ? 0.6 : 1 }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'joining' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Joining Details</h2>
            {joining ? (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm"><span style={{ color: 'var(--foreground-muted)' }}>Status:</span> {joining.joiningStatus}</p>
                {joining.joiningDate && <p className="text-sm mt-1"><span style={{ color: 'var(--foreground-muted)' }}>Planned Joining Date:</span> {new Date(joining.joiningDate).toLocaleDateString()}</p>}
                {joining.actualJoiningDate && <p className="text-sm mt-1"><span style={{ color: 'var(--foreground-muted)' }}>Actual Joining Date:</span> {new Date(joining.actualJoiningDate).toLocaleDateString()}</p>}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No joining details yet. This will be available after your offer is accepted.</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Documents</h2>
            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <h3 className="text-sm font-medium">Upload a Document</h3>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                placeholder="Document name (e.g. Aadhaar copy)"
                value={newDoc.documentName}
                onChange={(e) => setNewDoc({ ...newDoc, documentName: e.target.value })}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                placeholder="File URL (after uploading to file storage)"
                value={newDoc.filePath}
                onChange={(e) => setNewDoc({ ...newDoc, filePath: e.target.value })}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                placeholder="Remarks (optional)"
                value={newDoc.remarks}
                onChange={(e) => setNewDoc({ ...newDoc, remarks: e.target.value })}
              />
              <button
                onClick={uploadDoc}
                disabled={uploadingDoc || !newDoc.documentName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)', opacity: uploadingDoc || !newDoc.documentName.trim() ? 0.6 : 1 }}
              >
                {uploadingDoc ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No documents uploaded yet.</p>
              ) : (
                documents.map((d) => (
                  <div key={d.id} className="rounded-lg border p-3 flex justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium">{d.fileName ?? '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{d.documentType?.documentName ?? '—'}</p>
                      {d.remarks && <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{d.remarks}</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: d.status === 'Verified' ? '#dcfce7' : d.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: d.status === 'Verified' ? '#166534' : d.status === 'Rejected' ? '#991b1b' : '#92400e' }}>{d.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Messages with HR</h2>
            <div className="rounded-lg border p-3 space-y-2 max-h-80 overflow-y-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              {messages.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--foreground-muted)' }}>No messages yet. Send a message to HR below.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromRole === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-3 py-2 max-w-[80%] ${m.fromRole === 'candidate' ? 'text-white' : ''}`} style={{ backgroundColor: m.fromRole === 'candidate' ? 'var(--accent)' : 'var(--background)' }}>
                      <p className="text-xs font-medium" style={{ color: m.fromRole === 'candidate' ? '#fff' : 'var(--foreground-muted)' }}>{m.fromName}</p>
                      <p className="text-sm" style={{ color: m.fromRole === 'candidate' ? '#fff' : 'var(--foreground)' }}>{m.message}</p>
                      <p className="text-xs mt-1" style={{ color: m.fromRole === 'candidate' ? 'rgba(255,255,255,0.7)' : 'var(--foreground-muted)' }}>{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                placeholder="Type a message to HR..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button
                onClick={sendMessage}
                disabled={sendingMessage || !newMessage.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)', opacity: sendingMessage || !newMessage.trim() ? 0.6 : 1 }}
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t mt-8 py-4 text-center" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Suki HRMS Candidate Portal · This link is private. Do not share.
        </p>
      </footer>
    </div>
  );
}
