/**
 * Other Documents tab — BRD §7.8.
 * Company configures doc types in OtherJoiningDocType master.
 * During joining, HR/candidate selects a doc type and uploads the document.
 * On push-to-employee, these flow to EmployeeDocument (KYC & Statutory → Document Upload).
 */

'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface DocTypeOption { id: number; docCode: string; docName: string; mandatory: boolean; }
interface OtherDocRow {
  id: number;
  otherDocTypeId: number;
  documentName: string;
  fileName: string | null;
  filePath: string | null;
  verificationStatus: string;
  remarks: string | null;
  uploadedAt: string;
  otherDocType: { id: number; docCode: string; docName: string; mandatory: boolean };
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function OtherDocumentsTab() {
  return (
    <Suspense fallback={<div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}>
      <OtherDocumentsInner />
    </Suspense>
  );
}

function OtherDocumentsInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState(searchParams.get('candidateId') ?? '');
  const [docTypes, setDocTypes] = useState<DocTypeOption[]>([]);
  const [documents, setDocuments] = useState<OtherDocRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ otherDocTypeId: '', documentName: '', fileName: '', filePath: '', remarks: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()).then((j) => setCandidates(j.data ?? []));
    fetch('/api/masters/other-joining-doc-types').then((r) => r.json()).then((j) => setDocTypes(j.data ?? []));
  }, []);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const docTypeOptions = docTypes.map((d) => ({ label: `${d.docName}${d.mandatory ? ' *' : ''}`, value: d.id }));

  const fetchDocuments = useCallback(async (candidateId: string) => {
    if (!candidateId) { setDocuments([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}/other-documents`);
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to fetch');
      const json: { data: OtherDocRow[] } = await res.json();
      setDocuments(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments(selectedCandidate);
  }, [selectedCandidate, fetchDocuments]);

  const handleAdd = async () => {
    if (!selectedCandidate || !newDoc.otherDocTypeId || !newDoc.documentName) {
      toast.error('Please select a document type and enter a document name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/other-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otherDocTypeId: Number(newDoc.otherDocTypeId),
          documentName: newDoc.documentName,
          fileName: newDoc.fileName || null,
          filePath: newDoc.filePath || null,
          remarks: newDoc.remarks || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to add document');
      toast.success('Document added successfully.');
      setFormOpen(false);
      setNewDoc({ otherDocTypeId: '', documentName: '', fileName: '', filePath: '', remarks: '' });
      fetchDocuments(selectedCandidate);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (docId: number, status: string) => {
    const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/other-documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationStatus: status, candidateId: Number(selectedCandidate), otherDocTypeId: 0, documentName: '' }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Update failed');
      return;
    }
    fetchDocuments(selectedCandidate);
  };

  const deleteDoc = async (docId: number) => {
    if (!confirm('Delete this document?')) return;
    const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/other-documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? 'Delete failed');
      return;
    }
    fetchDocuments(selectedCandidate);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Other Joining Documents</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Upload miscellaneous joining documents configured by the company (BRD §7.8).
          On push-to-employee, these flow to Employee Master → KYC & Statutory → Document Upload.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Candidate</label>
          <SearchableSelect
            options={candidateOptions}
            value={selectedCandidate}
            onChange={(v) => setSelectedCandidate(String(v))}
            placeholder="Select candidate..."
          />
        </div>
        <div className="flex items-end">
          {selectedCandidate && (
            <button onClick={() => setFormOpen(!formOpen)} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>
              {formOpen ? 'Cancel' : '+ Add Document'}
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload New Document</h3>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Document Type *</label>
            <SearchableSelect
              options={docTypeOptions}
              value={newDoc.otherDocTypeId}
              onChange={(v) => setNewDoc({ ...newDoc, otherDocTypeId: String(v) })}
              placeholder="Select document type..."
            />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Document Name *</label>
            <input className={inputClass} style={inputStyle} value={newDoc.documentName} onChange={(e) => setNewDoc({ ...newDoc, documentName: e.target.value })} placeholder="e.g. Medical Certificate — Dr. ABC" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>File Name</label>
              <input className={inputClass} style={inputStyle} value={newDoc.fileName} onChange={(e) => setNewDoc({ ...newDoc, fileName: e.target.value })} placeholder="e.g. medical.pdf" />
            </div>
            <div>
              <label className={labelClass} style={{ color: 'var(--foreground)' }}>File Path / URL</label>
              <input className={inputClass} style={inputStyle} value={newDoc.filePath} onChange={(e) => setNewDoc({ ...newDoc, filePath: e.target.value })} placeholder="/uploads/medical.pdf" />
            </div>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Remarks</label>
            <textarea className={inputClass} style={inputStyle} rows={2} value={newDoc.remarks} onChange={(e) => setNewDoc({ ...newDoc, remarks: e.target.value })} />
          </div>
          <button onClick={handleAdd} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Saving...' : 'Save Document'}
          </button>
        </div>
      )}

      {!selectedCandidate ? (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Select a candidate to view and upload other documents.</p>
      ) : loading ? (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No other documents uploaded yet. Click + Add Document to upload.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="rounded-lg border p-3 flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.otherDocType.docName}</span>
                  {d.otherDocType.mandatory && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Mandatory</span>}
                </div>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{d.documentName}</p>
                {d.fileName && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>File: {d.fileName}</p>}
                {d.remarks && <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{d.remarks}</p>}
                <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>Uploaded: {new Date(d.uploadedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: d.verificationStatus === 'Verified' ? '#dcfce7' : d.verificationStatus === 'Rejected' ? '#fee2e2' : '#fef3c7', color: d.verificationStatus === 'Verified' ? '#166534' : d.verificationStatus === 'Rejected' ? '#991b1b' : '#92400e' }}>
                  {d.verificationStatus}
                </span>
                {d.verificationStatus === 'Pending' && (
                  <>
                    <button onClick={() => updateStatus(d.id, 'Verified')} className="text-xs font-medium hover:underline" style={{ color: '#166534' }}>Verify</button>
                    <button onClick={() => updateStatus(d.id, 'Rejected')} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Reject</button>
                  </>
                )}
                <button onClick={() => deleteDoc(d.id)} className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docTypes.length === 0 && selectedCandidate && (
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: '#fef3c7' }}>
          <p className="text-sm" style={{ color: '#92400e' }}>
            No document types configured. An admin must add document types in Masters → Other Joining Doc Types before documents can be uploaded.
          </p>
        </div>
      )}
    </div>
  );
}
