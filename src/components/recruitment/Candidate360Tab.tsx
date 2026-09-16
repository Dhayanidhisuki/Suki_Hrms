/**
 * Candidate 360° tab — full profile with all relations (BRD §5.18).
 * Reads ?candidateId= from the URL. Shows header with stage + action buttons,
 * and sub-tabs: Overview, Personal, Call, Interview, Documents, Activity.
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface Candidate360 {
  id: number;
  applicationNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  email: string;
  dateOfBirth: string | null;
  aadhaar: string | null;
  title: string | null;
  departmentId: number | null;
  designationId: number | null;
  currentStatusId: number | null;
  createdAt: string;
  department?: { id: number; name: string; code: string };
  designation?: { id: number; name: string; code: string };
  currentStatus?: { id: number; statusCode: string; statusName: string; color: string | null; stageCategory: string };
  jobPosting?: { id: number; title: string };
  sourceChannel?: { id: number; channelName: string };
  detail?: { address?: string; totalExperience?: string; currentCompany?: string; currentCTC?: string; expectedCTC?: string; noticePeriod?: string; highestQualification?: string; skills?: string; gender?: string; bloodGroup?: string; maritalStatus?: string; nationality?: string; languages?: string; spouseName?: string };
  documents?: { id: number; documentType?: { documentName: string }; fileName: string; filePath: string; status: string; remarks?: string | null; uploadedAt: string; verifiedAt?: string | null }[];
  activityLogs?: { id: number; action: string; fromStatus?: string | null; toStatus?: string | null; remarks?: string | null; createdAt: string }[];
  callInterviews?: { id: number; callOutcome: string; callDate: string; callTime: string; remarks?: string | null; nextAction?: string | null }[];
  interviewSchedules?: { id: number; interviewLevel?: { levelName: string }; interviewType?: { typeName: string }; scheduledDate: string; scheduledTime: string; startTime?: string; mode: string; status: string; interviewer?: { firstName: string; lastName: string }; evaluationSummary?: { totalScore: number; maxScore?: number | null; result: string; recommendation?: string | null } }[];
  bgvRecords?: { id: number; bgvStep?: { stepName: string }; status: string; remarks?: string | null }[];
  checklistItems?: { id: number; checklistMaster?: { itemName: string }; status: string }[];
  offerLetters?: { id: number; offerNo: string; status: string; proposedSalary?: number | null }[];
  appointmentOrders?: { id: number; apptNo: string; status: string }[];
  joining?: { id: number; joiningStatus: string; joiningDate?: string | null };
  internships?: { id: number; internId: string; status: string }[];
  communications?: { id: number; eventType: string; subject: string; status: string; sentAt: string }[];
}

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface StatusOption { id: number; statusCode: string; statusName: string; color: string | null; }

const SUB_TABS = ['Overview', 'Personal', 'Application', 'Call', 'Interview', 'Evaluation', 'Documents', 'Offer', 'Joining', 'Activity'] as const;
type SubTab = (typeof SUB_TABS)[number];

export default function Candidate360Tab() {
  return (
    <Suspense fallback={<div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}>
      <Candidate360Inner />
    </Suspense>
  );
}

function Candidate360Inner() {
  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidateId') ?? '';

  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedId, setSelectedId] = useState(candidateId);
  const [data, setData] = useState<Candidate360 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('Overview');
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/recruitment/candidates?limit=20').then((r) => r.json()).then((j) => setCandidates(j.data ?? []));
    fetch('/api/masters/recruitment-status?limit=100').then((r) => r.json()).then((j) => setStatuses(j.data ?? []));
  }, []);

  useEffect(() => {
    if (candidateId && !selectedId) setSelectedId(candidateId);
  }, [candidateId]);

  useEffect(() => {
    if (!selectedId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/recruitment/candidates/${selectedId}/360`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setData(d); else setError('Candidate not found'); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const candidateOptions = candidates.map((c) => ({
    label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`,
    value: c.id,
  }));

  const updateStatus = async (statusId: number) => {
    if (!selectedId) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${selectedId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId }),
      });
      if (res.ok) {
        const json = await res.json();
        setData((d) => d ? { ...d, currentStatus: json.status } : d);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!selectedId) {
    return (
      <div className="max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Search candidate to view 360°</label>
          <SearchableSelect
            value={selectedId}
            options={candidateOptions}
            onChange={(v) => setSelectedId(String(v))}
            placeholder="Search by application no or name..."
          />
        </div>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Or click a row in the Applicant Pipeline tab to open a candidate{String.fromCharCode(39)}s 360° profile.
        </p>
      </div>
    );
  }

  if (loading) return <div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading 360°...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const s = data.currentStatus;

  return (
    <div className="space-y-4">
      {/* Candidate selector */}
      <div className="max-w-md">
        <SearchableSelect
          value={selectedId}
          options={candidateOptions}
          onChange={(v) => setSelectedId(String(v))}
          placeholder="Switch candidate..."
        />
      </div>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{data.fullName}</h2>
              {s && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: (s.color ?? '#6b7280') + '20', color: s.color ?? '#6b7280' }}>
                  {s.statusName}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
              {data.applicationNo} · {data.mobile} · {data.email}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
              {data.department?.name ?? '—'} / {data.designation?.name ?? '—'}
              {data.jobPosting ? ` · ${data.jobPosting.title}` : ''}
              {data.sourceChannel ? ` · ${data.sourceChannel.channelName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={inputStyle}
              value={s?.id ?? ''}
              onChange={(e) => updateStatus(Number(e.target.value))}
              disabled={statusUpdating}
            >
              <option value="">Set status...</option>
              {statuses.map((st) => <option key={st.id} value={st.id}>{st.statusName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition"
            style={{
              backgroundColor: subTab === t ? 'var(--accent)' : 'transparent',
              color: subTab === t ? '#fff' : 'var(--foreground-muted)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="card p-5">
        {subTab === 'Overview' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Application No" value={data.applicationNo} />
              <InfoRow label="Applied Date" value={new Date(data.createdAt).toLocaleDateString()} />
              <InfoRow label="Status" value={s?.statusName ?? '—'} />
              <InfoRow label="Stage" value={s?.stageCategory ?? '—'} />
              <InfoRow label="Department" value={data.department?.name ?? '—'} />
              <InfoRow label="Designation" value={data.designation?.name ?? '—'} />
              <InfoRow label="Job Posting" value={data.jobPosting?.title ?? '—'} />
              <InfoRow label="Source" value={data.sourceChannel?.channelName ?? '—'} />
            </div>
            <div className="grid grid-cols-4 gap-3 pt-3">
              <StatBox label="Calls" value={data.callInterviews?.length ?? 0} />
              <StatBox label="Interviews" value={data.interviewSchedules?.length ?? 0} />
              <StatBox label="Documents" value={data.documents?.length ?? 0} />
              <StatBox label="Offers" value={data.offerLetters?.length ?? 0} />
            </div>

            {/* Candidate Self-Service Portal link generator (BRD §10.6) */}
            <div className="rounded-lg border p-3 mt-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>Candidate Portal Link</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>Generate a token-based link the candidate can use to view status, upload documents, accept/reject offers, and message HR.</p>
                </div>
                <button
                  onClick={async () => {
                    setPortalLoading(true);
                    try {
                      const res = await fetch('/api/recruitment/portal-tokens', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ candidateId: data.id }),
                      });
                      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
                      const json = await res.json();
                      setPortalLink(json.portalLink);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to generate link');
                    } finally {
                      setPortalLoading(false);
                    }
                  }}
                  disabled={portalLoading}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--accent)', opacity: portalLoading ? 0.6 : 1 }}
                >
                  {portalLoading ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
              {portalLink && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={portalLink}
                    className="flex-1 rounded border px-2 py-1 text-xs"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(portalLink); alert('Link copied to clipboard'); }}
                    className="rounded px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'Personal' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Personal Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Title" value={data.title ?? '—'} />
              <InfoRow label="Full Name" value={data.fullName} />
              <InfoRow label="Mobile" value={data.mobile} />
              <InfoRow label="Email" value={data.email} />
              <InfoRow label="Date of Birth" value={data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString() : '—'} />
              <InfoRow label="Aadhaar" value={data.aadhaar ?? '—'} />
            </div>
            {data.detail && (
              <>
                <h4 className="text-xs font-semibold uppercase pt-3" style={{ color: 'var(--foreground-muted)' }}>Extended Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Gender" value={data.detail.gender ?? '—'} />
                  <InfoRow label="Blood Group" value={data.detail.bloodGroup ?? '—'} />
                  <InfoRow label="Marital Status" value={data.detail.maritalStatus ?? '—'} />
                  <InfoRow label="Nationality" value={data.detail.nationality ?? '—'} />
                  <InfoRow label="Languages" value={data.detail.languages ?? '—'} />
                  <InfoRow label="Spouse Name" value={data.detail.spouseName ?? '—'} />
                </div>
              </>
            )}
          </div>
        )}

        {subTab === 'Application' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Application Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Application No" value={data.applicationNo} />
              <InfoRow label="Applied On" value={new Date(data.createdAt).toLocaleDateString()} />
              <InfoRow label="Department" value={data.department?.name ?? '—'} />
              <InfoRow label="Designation" value={data.designation?.name ?? '—'} />
              <InfoRow label="Job Posting" value={data.jobPosting?.title ?? '—'} />
              <InfoRow label="Source" value={data.sourceChannel?.channelName ?? '—'} />
              <InfoRow label="Current Status" value={data.currentStatus?.statusName ?? '—'} />
            </div>
            {data.detail && (
              <>
                <h4 className="text-xs font-semibold uppercase pt-3" style={{ color: 'var(--foreground-muted)' }}>Profile Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Total Experience" value={data.detail.totalExperience ?? '—'} />
                  <InfoRow label="Current Company" value={data.detail.currentCompany ?? '—'} />
                  <InfoRow label="Current CTC" value={data.detail.currentCTC ?? '—'} />
                  <InfoRow label="Expected CTC" value={data.detail.expectedCTC ?? '—'} />
                  <InfoRow label="Notice Period" value={data.detail.noticePeriod ?? '—'} />
                  <InfoRow label="Highest Qualification" value={data.detail.highestQualification ?? '—'} />
                </div>
                {data.detail.skills && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>Skills</span>
                    <p className="text-sm mt-1" style={{ color: 'var(--foreground)' }}>{data.detail.skills}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {subTab === 'Call' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Call History ({data.callInterviews?.length ?? 0})</h3>
            {(data.callInterviews?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No calls logged yet.</p>
            ) : (
              <div className="space-y-2">
                {data.callInterviews!.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.callOutcome}</span>
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{new Date(c.callDate).toLocaleDateString()} {c.callTime}</span>
                    </div>
                    {c.remarks && <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{c.remarks}</p>}
                    {c.nextAction && <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>Next: {c.nextAction}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Interview' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Interview History ({data.interviewSchedules?.length ?? 0})</h3>
            {(data.interviewSchedules?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No interviews scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {data.interviewSchedules!.map((i) => (
                  <div key={i.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {i.interviewLevel?.levelName} · {i.interviewType?.typeName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: i.status === 'Completed' ? '#dcfce7' : i.status === 'Pending' ? '#fef3c7' : '#fee2e2', color: i.status === 'Completed' ? '#166534' : i.status === 'Pending' ? '#92400e' : '#991b1b' }}>
                        {i.status}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                      {new Date(i.scheduledDate).toLocaleDateString()} {i.startTime} · {i.interviewer ? `${i.interviewer.firstName} ${i.interviewer.lastName}` : '—'} · {i.mode}
                    </p>
                    {i.evaluationSummary && (
                      <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>
                        Score: {i.evaluationSummary.totalScore}/{i.evaluationSummary.maxScore ?? '?'} · {i.evaluationSummary.result} · {i.evaluationSummary.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Documents' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Documents ({data.documents?.length ?? 0})</h3>
            {(data.documents?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {data.documents!.map((d) => (
                  <div key={d.id} className="rounded-lg border p-3 flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.documentType?.documentName ?? 'Unknown'}</span>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{d.fileName ?? 'No filename'}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: d.status === 'Verified' ? '#dcfce7' : d.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: d.status === 'Verified' ? '#166534' : d.status === 'Rejected' ? '#991b1b' : '#92400e' }}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Evaluation' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Evaluation Summaries</h3>
            {(data.interviewSchedules?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No evaluations yet.</p>
            ) : (
              <div className="space-y-2">
                {data.interviewSchedules!.filter((i) => i.evaluationSummary).map((i) => (
                  <div key={i.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {i.interviewLevel?.levelName} · {i.interviewType?.typeName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: i.evaluationSummary!.result === 'Pass' ? '#dcfce7' : i.evaluationSummary!.result === 'Fail' ? '#fee2e2' : '#fef3c7', color: i.evaluationSummary!.result === 'Pass' ? '#166534' : i.evaluationSummary!.result === 'Fail' ? '#991b1b' : '#92400e' }}>
                        {i.evaluationSummary!.result}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                      Score: {i.evaluationSummary!.totalScore}/{i.evaluationSummary!.maxScore ?? '?'}
                    </p>
                    {i.evaluationSummary!.recommendation && (
                      <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>Recommendation: {i.evaluationSummary!.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Offer' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Offer Letters ({data.offerLetters?.length ?? 0})</h3>
            {(data.offerLetters?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No offers issued yet.</p>
            ) : (
              <div className="space-y-2">
                {data.offerLetters!.map((o) => (
                  <div key={o.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{o.offerNo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: o.status === 'Accepted' ? '#dcfce7' : o.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: o.status === 'Accepted' ? '#166534' : o.status === 'Rejected' ? '#991b1b' : '#92400e' }}>{o.status}</span>
                    </div>
                    {o.proposedSalary && <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>Proposed CTC: ₹{o.proposedSalary.toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            )}
            <h3 className="text-sm font-semibold pt-3" style={{ color: 'var(--foreground)' }}>Appointment Orders ({data.appointmentOrders?.length ?? 0})</h3>
            {(data.appointmentOrders?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No appointment orders issued yet.</p>
            ) : (
              <div className="space-y-2">
                {data.appointmentOrders!.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.apptNo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: a.status === 'Accepted' ? '#dcfce7' : a.status === 'Declined' ? '#fee2e2' : '#fef3c7', color: a.status === 'Accepted' ? '#166534' : a.status === 'Declined' ? '#991b1b' : '#92400e' }}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Joining' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Joining Status</h3>
            {data.joining ? (
              <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Joining #{data.joining.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: data.joining.joiningStatus === 'Joined' ? '#dcfce7' : '#fef3c7', color: data.joining.joiningStatus === 'Joined' ? '#166534' : '#92400e' }}>{data.joining.joiningStatus}</span>
                </div>
                {data.joining.joiningDate && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Planned: {new Date(data.joining.joiningDate).toLocaleDateString()}</p>}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No joining record yet.</p>
            )}

            <h3 className="text-sm font-semibold pt-3" style={{ color: 'var(--foreground)' }}>Joining Checklist ({data.checklistItems?.length ?? 0})</h3>
            {(data.checklistItems?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No checklist items.</p>
            ) : (
              <div className="space-y-1">
                {data.checklistItems!.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--foreground)' }}>{c.checklistMaster?.itemName ?? 'Unknown'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: c.status === 'Received' || c.status === 'Verified' ? '#dcfce7' : c.status === 'Not Required' ? '#e5e7eb' : '#fef3c7', color: c.status === 'Received' || c.status === 'Verified' ? '#166534' : c.status === 'Not Required' ? '#6b7280' : '#92400e' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold pt-3" style={{ color: 'var(--foreground)' }}>BGV Records ({data.bgvRecords?.length ?? 0})</h3>
            {(data.bgvRecords?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No BGV records.</p>
            ) : (
              <div className="space-y-1">
                {data.bgvRecords!.map((b) => (
                  <div key={b.id} className="flex justify-between text-sm rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--foreground)' }}>{b.bgvStep?.stepName ?? 'Unknown'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: b.status === 'Completed' ? '#dcfce7' : b.status === 'Failed' ? '#fee2e2' : '#fef3c7', color: b.status === 'Completed' ? '#166534' : b.status === 'Failed' ? '#991b1b' : '#92400e' }}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold pt-3" style={{ color: 'var(--foreground)' }}>Internships ({data.internships?.length ?? 0})</h3>
            {(data.internships?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No internship records.</p>
            ) : (
              <div className="space-y-1">
                {data.internships!.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm rounded border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--foreground)' }}>{i.internId}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: i.status === 'Completed' ? '#dcfce7' : i.status === 'Terminated' ? '#fee2e2' : '#fef3c7', color: i.status === 'Completed' ? '#166534' : i.status === 'Terminated' ? '#991b1b' : '#92400e' }}>{i.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {subTab === 'Activity' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Activity Log ({data.activityLogs?.length ?? 0})</h3>
            {(data.activityLogs?.length ?? 0) === 0 ? (
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No activity logged yet.</p>
            ) : (
              <div className="space-y-2">
                {data.activityLogs!.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.action}</span>
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
      </div>
    </div>
  );
}

const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{label}</span>
      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{value}</p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
      <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{label}</p>
    </div>
  );
}
