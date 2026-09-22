/**
 * Document Verification tab — upload, verify, reject candidate documents (BRD §5.13, §10.3).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable, SearchableSelect, useToast, type Column } from '@/components/ui';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface DocTypeOption { id: number; documentName: string; documentCode: string; }

interface DocRow {
  id: number;
  fileName: string | null;
  fileUrl: string | null;
  status: string;
  remarks: string | null;
  verifiedAt: string | null;
  documentType: { id: number; documentName: string; category: string };
  verifiedBy: { id: number; firstName: string; lastName: string } | null;
}

export default function DocVerificationTab() {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload form
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()),
      fetch('/api/masters/document-types?limit=50').then((r) => r.json()),
    ]).then(([cands, dtypes]) => {
      setCandidates(cands?.data ?? []);
      setDocTypes(dtypes?.data ?? []);
    });
  }, []);

  const fetchDocs = useCallback(async () => {
    if (!selectedCandidate) { setDocs([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/documents`);
      const json = await res.json();
      setDocs(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [selectedCandidate, toast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));
  const docTypeOptions = docTypes.map((d) => ({ label: `${d.documentCode} — ${d.documentName}`, value: d.id }));

  const upload = async () => {
    if (!selectedCandidate || !uploadDocType || !uploadFile) {
      toast.error('Candidate, document type, and file are required');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('documentTypeId', uploadDocType);
      formData.set('file', uploadFile);
      if (uploadRemarks) formData.set('remarks', uploadRemarks);
      const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/documents`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      toast.success('Document uploaded');
      setUploadDocType('');
      setUploadFile(null);
      setUploadRemarks('');
      fetchDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const verifyDoc = async (docId: number, status: string) => {
    try {
      const res = await fetch(`/api/recruitment/candidates/${selectedCandidate}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const columns: Column<DocRow>[] = [
    { key: 'documentType', label: 'Document Type', render: (row) => row.documentType?.documentName ?? '—' },
    { key: 'fileName', label: 'File', render: (row) => row.fileName ?? '—' },
    { key: 'category', label: 'Category', render: (row) => row.documentType?.category ?? '—' },
    {
      key: 'status', label: 'Status',
      render: (row) => {
        const colors: Record<string, string> = { Verified: '#dcfce7', Uploaded: '#dbeafe', Rejected: '#fee2e2', 'Re-upload': '#fef3c7' };
        const textColors: Record<string, string> = { Verified: '#166534', Uploaded: '#1e40af', Rejected: '#991b1b', 'Re-upload': '#92400e' };
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: colors[row.status] ?? '#f3f4f6', color: textColors[row.status] ?? '#6b7280' }}>{row.status}</span>;
      },
    },
    { key: 'remarks', label: 'Remarks', render: (row) => row.remarks ?? '—' },
    { key: 'verifiedAt', label: 'Verified', render: (row) => row.verifiedAt ? new Date(row.verifiedAt).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Select Candidate</label>
        <SearchableSelect value={selectedCandidate} options={candidateOptions} onChange={(v) => setSelectedCandidate(String(v))} placeholder="Search candidate..." />
      </div>

      {selectedCandidate && (
        <>
          {/* Upload form */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload Document</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Document Type *</label>
                <SearchableSelect value={uploadDocType} options={docTypeOptions} onChange={(v) => setUploadDocType(String(v))} placeholder="Select type" />
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>File *</label>
                <input
                  type="file"
                  className="w-full text-sm"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Remarks</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={inputStyle}
                  value={uploadRemarks}
                  onChange={(e) => setUploadRemarks(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={upload} disabled={uploading} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          {/* Documents table */}
          <DataTable
            columns={columns}
            data={docs}
            loading={loading}
            renderRowActions={(row) => (
              <div className="flex gap-1">
                {row.status !== 'Verified' && (
                  <button onClick={() => verifyDoc(row.id, 'Verified')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                    Verify
                  </button>
                )}
                {row.status !== 'Rejected' && (
                  <button onClick={() => verifyDoc(row.id, 'Rejected')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                    Reject
                  </button>
                )}
                {row.status !== 'Re-upload' && (
                  <button onClick={() => verifyDoc(row.id, 'Re-upload')} className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    Re-upload
                  </button>
                )}
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}

const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
