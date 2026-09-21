'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, PageHeader } from '@/components/ui';
import DocumentUploadModal from '@/components/documents/DocumentUploadModal';
import DocumentPreviewDrawer from '@/components/documents/DocumentPreviewDrawer';
import { type PlatformDocument } from '@/components/documents/types';

const PIPELINE = ['REGISTERED', 'SCREENING', 'INTERVIEW', 'DOC_VERIFICATION', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED'];

type Applicant = {
  id: number;
  applicationNo: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  status: string;
  employeeId: number | null;
  offerNo: string | null;
};

export default function Applicant360Page() {
  const params = useParams();
  const id = String(params.id);
  const [row, setRow] = useState<Applicant | null>(null);
  const [docs, setDocs] = useState<PlatformDocument[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<PlatformDocument | null>(null);
  const [status, setStatus] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convert, setConvert] = useState({
    gender: 'Male',
    pan: '',
    aadhaar: '',
    offerNo: '',
    departmentCode: '',
    designationCode: '',
    gradeCode: '',
    employeeTypeCode: '',
    reportingManagerCode: '',
    dateOfJoining: '',
    annualCtc: '',
    permanentLine1: '',
    permanentCity: '',
    permanentState: '',
    permanentPincode: '',
    dateOfBirth: '',
  });

  const pushToEmployee = async () => {
    setError(null);
    const res = await fetch(`/api/recruitment/applicants/${id}/push-to-employee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: convert.gender,
        pan: convert.pan,
        aadhaar: convert.aadhaar,
        offerNo: convert.offerNo || row?.offerNo,
        departmentCode: convert.departmentCode,
        designationCode: convert.designationCode,
        gradeCode: convert.gradeCode,
        employeeTypeCode: convert.employeeTypeCode,
        reportingManagerCode: convert.reportingManagerCode,
        dateOfJoining: convert.dateOfJoining,
        annualCtc: Number(convert.annualCtc),
        dateOfBirth: convert.dateOfBirth || undefined,
        permanentAddress: {
          line1: convert.permanentLine1,
          city: convert.permanentCity,
          state: convert.permanentState,
          pinCode: convert.permanentPincode,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Push failed');
      return;
    }
    setConvertOpen(false);
    await load();
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/recruitment/applicants/${id}`);
    if (!res.ok) {
      setError('Applicant not found');
      return;
    }
    const data = await res.json();
    setRow(data);
    setStatus(data.status);
    const dres = await fetch(`/api/platform/document?ownerEntityType=CANDIDATE&ownerEntityId=${id}`);
    if (dres.ok) setDocs((await dres.json()).data ?? []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveStatus = async () => {
    const res = await fetch(`/api/recruitment/applicants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Update failed');
    else await load();
  };

  if (!row) return <p className="text-sm">{error ?? 'Loading…'}</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Recruitment"
        title={`${row.firstName} ${row.lastName}`}
        description={`${row.applicationNo} · ${row.mobile} · ${row.email}`}
        actions={
          <Link href="/recruitment/applicants" className="text-sm" style={{ color: 'var(--accent)' }}>
            Back to pipeline
          </Link>
        }
      />
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Stage
          <select className="ml-2 rounded border px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            {PIPELINE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={saveStatus}>
          Save stage
        </Button>
        {row.employeeId && (
          <Link href={`/employees/${row.employeeId}?tab=documents`} style={{ color: 'var(--accent)' }}>
            Employee documents
          </Link>
        )}
        {!row.employeeId && (
          <Button type="button" variant="primary" onClick={() => setConvertOpen((v) => !v)}>
            Push to employee
          </Button>
        )}
      </div>

      {convertOpen && !row.employeeId && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)' }}>
          {(
            [
              ['offerNo', 'Offer no'],
              ['dateOfBirth', 'DOB', 'date'],
              ['pan', 'PAN'],
              ['aadhaar', 'Aadhaar (12 digits)'],
              ['departmentCode', 'Department code'],
              ['designationCode', 'Designation code'],
              ['gradeCode', 'Grade code'],
              ['employeeTypeCode', 'Employee type code'],
              ['reportingManagerCode', 'Manager emp code'],
              ['dateOfJoining', 'DOJ', 'date'],
              ['annualCtc', 'Annual CTC'],
              ['permanentLine1', 'Address line 1'],
              ['permanentCity', 'City'],
              ['permanentState', 'State'],
              ['permanentPincode', 'Pincode'],
            ] as Array<[string, string, string?]>
          ).map(([key, label, type]) => (
            <label key={key} className="block">
              {label}
              <input
                type={type ?? 'text'}
                className="mt-1 w-full rounded border px-2 py-1"
                value={(convert as Record<string, string>)[key]}
                onChange={(e) => setConvert((c) => ({ ...c, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block">
            Gender
            <select className="mt-1 w-full rounded border px-2 py-1" value={convert.gender} onChange={(e) => setConvert((c) => ({ ...c, gender: e.target.value }))}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </label>
          <div className="col-span-2">
            <Button type="button" variant="primary" onClick={() => void pushToEmployee()}>
              Create employee and move documents
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Candidate documents</h2>
          <Button type="button" variant="primary" onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        </div>
        <p className="mb-3 text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Verify here before offer. On push-to-employee these files stay in the same store under the new emp ID.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--foreground-muted)' }}>
              <th className="py-2">Type</th>
              <th>Status</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="cursor-pointer" onClick={() => setPreview(d)}>
                <td className="py-2">{d.documentTypeName ?? d.documentTypeCode}</td>
                <td>{d.verificationStatus}</td>
                <td>{d.documentRef}</td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4" style={{ color: 'var(--foreground-muted)' }}>
                  No files yet. Upload Aadhaar, PAN, certificates, resume.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DocumentUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void load()}
        businessCategory="RECRUITMENT"
        lockedOwner={{ ownerEntityType: 'CANDIDATE', ownerEntityId: Number(id), label: `${row.applicationNo} — ${row.firstName} ${row.lastName}` }}
      />
      <DocumentPreviewDrawer doc={preview} onClose={() => setPreview(null)} onChanged={() => void load()} onViewHistory={() => setPreview(null)} />
    </div>
  );
}
