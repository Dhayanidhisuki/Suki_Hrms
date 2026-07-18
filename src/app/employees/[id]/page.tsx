/**
 * Employee Master — View page
 * Shows full employee details with all relations.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface EmployeeDetail {
  id: number;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  personalDetails: {
    dateOfBirth: string | null;
    gender: string | null;
    bloodGroup: string | null;
    maritalStatus: string | null;
    personalEmail: string | null;
    mobileNumber: string | null;
    presentAddress: string | null;
    permanentAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  } | null;
  jobInfos: Array<{
    id: number;
    jobTitle: string | null;
    joinDate: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    department: { name: string };
    designation: { name: string };
    employeeType: { name: string };
    subDepartment: { name: string } | null;
    grade: { name: string } | null;
    level: { name: string } | null;
  }>;
  salaryStructures: Array<{
    id: number;
    monthlyCtc: string;
    annualCtc: string;
    basic: string;
    hra: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
  bankDetail: {
    bankName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    accountType: string | null;
  } | null;
  dependents: Array<{
    id: number;
    name: string;
    relationship: string;
    dateOfBirth: string | null;
    isDependent: boolean;
  }>;
  experiences: Array<{
    id: number;
    companyName: string;
    designation: string;
    fromDate: string;
    toDate: string | null;
  }>;
  educations: Array<{
    id: number;
    qualification: string;
    institution: string | null;
    yearOfPassing: number | null;
    percentage: string | null;
  }>;
  documents: Array<{
    id: number;
    docType: string;
    docNumber: string | null;
    fileName: string | null;
    issuedDate: string | null;
    expiryDate: string | null;
    isVerified: boolean;
    expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';
    daysToExpiry: number | null;
  }>;
  documentExpirySummary: {
    total: number;
    expired: number;
    expiringSoon: number;
    valid: number;
    noExpiry: number;
  };
  assetAllocations: Array<{
    id: number;
    allocatedDate: string;
    assetMaster: { name: string; code: string };
  }>;
  exitInterview: {
    exitDate: string;
    exitType: string;
    exitReason: string | null;
  } | null;
  reportingManager: { firstName: string; lastName: string; employeeCode: string } | null;
}

type ExpiryStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';

function ExpiryPill({ status, daysToExpiry }: { status: ExpiryStatus; daysToExpiry: number | null }) {
  if (status === 'no_expiry') return null;
  const styles: Record<ExpiryStatus, string> = {
    valid: 'text-gray-400',
    expiring_soon: 'font-semibold border border-gray-400 text-gray-700 px-1.5 rounded',
    expired: 'font-bold border border-gray-900 text-gray-900 px-1.5 rounded',
    no_expiry: '',
  };
  const labels: Record<ExpiryStatus, string> = {
    valid: '',
    expiring_soon: `Expiring in ${daysToExpiry}d`,
    expired: `Expired ${Math.abs(daysToExpiry ?? 0)}d ago`,
    no_expiry: '',
  };
  if (status === 'valid') {
    return <span className="text-xs text-gray-400 ml-2">Valid</span>;
  }
  return <span className={`text-xs ml-2 ${styles[status]}`}>{labels[status]}</span>;
}

export default function EmployeeViewPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document attach form state
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('kpi');
  const [docNumber, setDocNumber] = useState('');
  const [fileName, setFileName] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const fetchEmployee = () => {
    if (!params?.id) return;
    fetch(`/api/employees/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Employee not found');
        return res.json();
      })
      .then((data) => setEmployee(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployee();
  }, [params?.id]);

  const handleAttachDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocLoading(true);
    setDocError(null);
    try {
      const res = await fetch(`/api/employees/${params.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          docNumber: docNumber || null,
          fileName: fileName || null,
          issuedDate: issuedDate || null,
          expiryDate: expiryDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to attach document');
      }
      setShowDocForm(false);
      setDocType('kpi');
      setDocNumber('');
      setFileName('');
      setIssuedDate('');
      setExpiryDate('');
      fetchEmployee();
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDocLoading(false);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Remove this document?')) return;
    const res = await fetch(`/api/employees/${params.id}/documents/${docId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchEmployee();
    } else {
      alert('Failed to delete document');
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-6 text-center text-gray-700 font-medium">{error}</div>;
  if (!employee) return <div className="p-6 text-center text-gray-500">Employee not found</div>;

  const currentJob = employee.jobInfos.find((j) => !j.effectiveTo) ?? employee.jobInfos[0];
  const currentSalary = employee.salaryStructures.find((s) => !s.effectiveTo) ?? employee.salaryStructures[0];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {employee.firstName} {employee.middleName ?? ''} {employee.lastName}
          </h1>
          <p className="text-gray-500">{employee.employeeCode}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/employees/${employee.id}/edit`}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            Edit
          </Link>
          <Link
            href="/employees"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        <span className={`px-3 py-1 text-sm rounded-full border ${
          employee.status === 'active'
            ? 'font-semibold border-gray-300 text-gray-700'
            : 'font-medium border-gray-200 text-gray-400'
        }`}>
          {employee.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Personal Details */}
        <Section title="Personal Details">
          <DetailRow label="Date of Birth" value={formatDate(employee.personalDetails?.dateOfBirth ?? null)} />
          <DetailRow label="Gender" value={employee.personalDetails?.gender ?? '—'} />
          <DetailRow label="Blood Group" value={employee.personalDetails?.bloodGroup ?? '—'} />
          <DetailRow label="Mobile" value={employee.personalDetails?.mobileNumber ?? '—'} />
          <DetailRow label="Email" value={employee.personalDetails?.personalEmail ?? '—'} />
          <DetailRow label="Present Address" value={employee.personalDetails?.presentAddress ?? '—'} />
        </Section>

        {/* Job Info */}
        <Section title="Job Information">
          <DetailRow label="Department" value={currentJob?.department.name ?? '—'} />
          <DetailRow label="Designation" value={currentJob?.designation.name ?? '—'} />
          <DetailRow label="Employee Type" value={currentJob?.employeeType.name ?? '—'} />
          <DetailRow label="Job Title" value={currentJob?.jobTitle ?? '—'} />
          <DetailRow label="Join Date" value={formatDate(currentJob?.joinDate ?? null)} />
          <DetailRow label="Grade" value={currentJob?.grade?.name ?? '—'} />
          <DetailRow label="Level" value={currentJob?.level?.name ?? '—'} />
          <DetailRow
            label="Reporting Manager"
            value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : '—'}
          />
        </Section>

        {/* Salary */}
        <Section title="Salary Structure (Current)">
          {currentSalary ? (
            <>
              <DetailRow label="Monthly CTC" value={`₹${Number(currentSalary.monthlyCtc).toLocaleString()}`} />
              <DetailRow label="Annual CTC" value={`₹${Number(currentSalary.annualCtc).toLocaleString()}`} />
              <DetailRow label="Basic" value={`₹${Number(currentSalary.basic).toLocaleString()}`} />
              <DetailRow label="HRA" value={`₹${Number(currentSalary.hra).toLocaleString()}`} />
              <DetailRow label="Effective From" value={formatDate(currentSalary.effectiveFrom)} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No salary structure defined</p>
          )}
        </Section>

        {/* Bank Details */}
        <Section title="Bank Details">
          {employee.bankDetail ? (
            <>
              <DetailRow label="Bank Name" value={employee.bankDetail.bankName ?? '—'} />
              <DetailRow label="Account Number" value={employee.bankDetail.accountNumber ?? '—'} />
              <DetailRow label="IFSC Code" value={employee.bankDetail.ifscCode ?? '—'} />
              <DetailRow label="Account Type" value={employee.bankDetail.accountType ?? '—'} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No bank details defined</p>
          )}
        </Section>

        {/* Dependents */}
        <Section title={`Dependents (${employee.dependents.length})`}>
          {employee.dependents.length === 0 ? (
            <p className="text-sm text-gray-400">No dependents recorded</p>
          ) : (
            <ul className="space-y-1">
              {employee.dependents.map((d) => (
                <li key={d.id} className="text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-gray-500"> — {d.relationship}</span>
                  {d.isDependent && <span className="text-gray-500 ml-2">(dependent)</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Experience */}
        <Section title={`Experience (${employee.experiences.length})`}>
          {employee.experiences.length === 0 ? (
            <p className="text-sm text-gray-400">No previous experience recorded</p>
          ) : (
            <ul className="space-y-2">
              {employee.experiences.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium">{e.companyName}</span>
                  <span className="text-gray-500"> — {e.designation}</span>
                  <span className="text-gray-400 block text-xs">
                    {formatDate(e.fromDate)} — {e.toDate ? formatDate(e.toDate) : 'Current'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Education */}
        <Section title={`Education (${employee.educations.length})`}>
          {employee.educations.length === 0 ? (
            <p className="text-sm text-gray-400">No education records</p>
          ) : (
            <ul className="space-y-1">
              {employee.educations.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium">{e.qualification}</span>
                  {e.institution && <span className="text-gray-500"> — {e.institution}</span>}
                  {e.yearOfPassing && <span className="text-gray-400 ml-2">({e.yearOfPassing})</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Documents (typed docs: Aadhaar, PAN, Passport, DL, other) */}
        <Section title={`Documents (${employee.documents.filter(d => !['kpi', 'jd'].includes(d.docType)).length})`}>
          {(() => {
            const typedDocs = employee.documents.filter(d => !['kpi', 'jd'].includes(d.docType));
            if (typedDocs.length === 0) {
              return <p className="text-sm text-gray-400">No documents recorded</p>;
            }
            return (
              <ul className="space-y-2">
                {typedDocs.map((d) => (
                  <li key={d.id} className="text-sm flex items-start justify-between">
                    <div>
                      <span className="font-medium capitalize">{d.docType}</span>
                      {d.docNumber && <span className="text-gray-500"> — {d.docNumber}</span>}
                      {d.issuedDate && <span className="text-gray-400 block text-xs">Issued: {formatDate(d.issuedDate)}</span>}
                      {d.expiryDate && <span className="text-gray-400 text-xs">Expires: {formatDate(d.expiryDate)}</span>}
                      <ExpiryPill status={d.expiryStatus} daysToExpiry={d.daysToExpiry} />
                      {d.isVerified && <span className="text-gray-600 ml-2 text-xs">✓ verified</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(d.id)}
                      className="text-gray-400 hover:text-gray-900 text-xs ml-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Section>

        {/* KPI / JD Attachments */}
        <Section title={`KPI / JD Attachments (${employee.documents.filter(d => ['kpi', 'jd'].includes(d.docType)).length})`}>
          {(() => {
            const kpiJdDocs = employee.documents.filter(d => ['kpi', 'jd'].includes(d.docType));
            return (
              <>
                {kpiJdDocs.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {kpiJdDocs.map((d) => (
                      <li key={d.id} className="text-sm flex items-start justify-between">
                        <div>
                          <span className="font-medium uppercase">{d.docType}</span>
                          {d.docNumber && <span className="text-gray-500"> — {d.docNumber}</span>}
                          {d.fileName && <span className="text-gray-400 block text-xs">{d.fileName}</span>}
                          {d.issuedDate && <span className="text-gray-400 block text-xs">Issued: {formatDate(d.issuedDate)}</span>}
                          {d.expiryDate && (
                            <>
                              <span className="text-gray-400 text-xs">Expires: {formatDate(d.expiryDate)}</span>
                              <ExpiryPill status={d.expiryStatus} daysToExpiry={d.daysToExpiry} />
                            </>
                          )}
                          {d.isVerified && <span className="text-gray-600 ml-2 text-xs">✓ verified</span>}
                        </div>
                        <button
                          onClick={() => handleDeleteDoc(d.id)}
                          className="text-gray-400 hover:text-gray-900 text-xs ml-2"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {kpiJdDocs.length === 0 && !showDocForm && (
                  <p className="text-sm text-gray-400 mb-3">No KPI/JD attachments</p>
                )}
                {docError && (
                  <div className="bg-gray-50 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg mb-3 text-sm">
                    {docError}
                  </div>
                )}
                {showDocForm ? (
                  <form onSubmit={handleAttachDoc} className="space-y-3 border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                          <option value="kpi">KPI</option>
                          <option value="jd">JD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Reference Number</label>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">File Name</label>
                        <input
                          type="text"
                          value={fileName}
                          onChange={(e) => setFileName(e.target.value)}
                          placeholder="e.g. KPI_2026_Q1.pdf"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Issued Date</label>
                        <input
                          type="date"
                          value={issuedDate}
                          onChange={(e) => setIssuedDate(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={docLoading}
                        className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        {docLoading ? 'Attaching...' : 'Attach'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowDocForm(false); setDocError(null); }}
                        className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowDocForm(true)}
                    className="text-sm text-gray-700 hover:text-gray-900 font-medium"
                  >
                    + Attach KPI / JD
                  </button>
                )}
              </>
            );
          })()}
        </Section>

        {/* Assets */}
        <Section title={`Allocated Assets (${employee.assetAllocations.length})`}>
          {employee.assetAllocations.length === 0 ? (
            <p className="text-sm text-gray-400">No assets allocated</p>
          ) : (
            <ul className="space-y-1">
              {employee.assetAllocations.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium">{a.assetMaster.name}</span>
                  <span className="text-gray-400 ml-2">({a.assetMaster.code})</span>
                  <span className="text-gray-400 block text-xs">Allocated: {formatDate(a.allocatedDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Exit Interview */}
        {employee.exitInterview && (
          <Section title="Exit Interview">
            <DetailRow label="Exit Date" value={formatDate(employee.exitInterview.exitDate)} />
            <DetailRow label="Exit Type" value={employee.exitInterview.exitType} />
            <DetailRow label="Reason" value={employee.exitInterview.exitReason ?? '—'} />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
