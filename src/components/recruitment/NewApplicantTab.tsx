/**
 * New Applicant tab — registration form with duplicate check (BRD §5.3).
 * Checks mobile, email, aadhaar for existing candidates (soft warning).
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface OrgOption { id: number; name: string; code: string; }
interface JobPostingOption { id: number; title: string; }
interface ChannelOption { id: number; channelName: string; channelCode: string; }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function NewApplicantTab() {
  const router = useRouter();
  const toast = useToast();
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [designations, setDesignations] = useState<OrgOption[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPostingOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);

  const [form, setForm] = useState({
    title: '', firstName: '', lastName: '', mobile: '', email: '',
    dateOfBirth: '', aadhaar: '', departmentId: '', designationId: '',
    jobPostingId: '', sourceChannelId: '', referenceComments: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/org-options?table=Department').then((r) => r.json()),
      fetch('/api/org-options?table=Designation').then((r) => r.json()),
      fetch('/api/recruitment/job-postings?limit=100').then((r) => r.json()),
      fetch('/api/masters/sourcing-channels?limit=100').then((r) => r.json()),
    ]).then(([depts, desigs, postings, chans]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setDesignations(Array.isArray(desigs) ? desigs : []);
      setJobPostings(postings?.data ?? []);
      setChannels(chans?.data ?? []);
    });
  }, []);

  const deptOptions = departments.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }));
  const desigOptions = designations.map((d) => ({ label: `${d.code} — ${d.name}`, value: d.id }));
  const postingOptions = jobPostings.map((p) => ({ label: p.title, value: p.id }));
  const channelOptions = channels.map((c) => ({ label: c.channelName, value: c.id }));

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDuplicateWarning(null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.mobile.trim()) e.mobile = 'Mobile is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (acknowledge = false) => {
    if (!validate()) return;
    setSubmitting(true);
    setDuplicateWarning(null);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
      };
      if (form.title) payload.title = form.title;
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.aadhaar) payload.aadhaar = form.aadhaar;
      if (form.departmentId) payload.departmentId = Number(form.departmentId);
      if (form.designationId) payload.designationId = Number(form.designationId);
      if (form.jobPostingId) payload.jobPostingId = Number(form.jobPostingId);
      if (form.sourceChannelId) payload.sourceChannelId = Number(form.sourceChannelId);
      if (form.referenceComments) payload.referenceComments = form.referenceComments;
      if (acknowledge) payload.acknowledgeDuplicate = true;

      const res = await fetch('/api/recruitment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        setDuplicateWarning(json.message);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Registration failed');
      toast.success(`Candidate ${json.applicationNo} registered successfully`);
      setForm({ title: '', firstName: '', lastName: '', mobile: '', email: '', dateOfBirth: '', aadhaar: '', departmentId: '', designationId: '', jobPostingId: '', sourceChannelId: '', referenceComments: '' });
      setTimeout(() => router.push(`/recruitment/applicants?tab=candidate-360&candidateId=${json.id}`), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      {duplicateWarning && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
          {duplicateWarning}
          <button onClick={() => submit(true)} className="ml-3 font-semibold underline">Continue anyway</button>
        </div>
      )}

      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Personal Details</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Title</label>
            <select className={inputClass} style={inputStyle} value={form.title} onChange={(e) => set('title', e.target.value)}>
              <option value="">—</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="Dr">Dr</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>First Name *</label>
            <input className={inputClass} style={inputStyle} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Last Name *</label>
            <input className={inputClass} style={inputStyle} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Mobile *</label>
            <input className={inputClass} style={inputStyle} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit" />
            {errors.mobile && <p className="text-xs text-red-600 mt-1">{errors.mobile}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Email *</label>
            <input className={inputClass} style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Date of Birth</label>
            <input type="date" className={inputClass} style={inputStyle} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Aadhaar</label>
          <input className={inputClass} style={inputStyle} value={form.aadhaar} onChange={(e) => set('aadhaar', e.target.value)} placeholder="12-digit (optional)" />
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Position & Source</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Department</label>
            <SearchableSelect value={form.departmentId} options={deptOptions} onChange={(v) => set('departmentId', String(v))} placeholder="Select department" />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Designation</label>
            <SearchableSelect value={form.designationId} options={desigOptions} onChange={(v) => set('designationId', String(v))} placeholder="Select designation" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Job Posting</label>
            <SearchableSelect value={form.jobPostingId} options={postingOptions} onChange={(v) => set('jobPostingId', String(v))} placeholder="Select posting" />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--foreground)' }}>Sourcing Channel</label>
            <SearchableSelect value={form.sourceChannelId} options={channelOptions} onChange={(v) => set('sourceChannelId', String(v))} placeholder="Select channel" />
          </div>
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--foreground)' }}>Reference / Comments</label>
          <textarea className={inputClass} style={inputStyle} rows={2} value={form.referenceComments} onChange={(e) => set('referenceComments', e.target.value)} placeholder="How did they hear about us? Any references?" />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className="rounded-lg px-6 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Registering...' : 'Register Candidate'}
        </button>
      </div>
    </div>
  );
}
