/**
 * Statutory Forms — unified component for all 6 joining forms (BRD §7.2-7.7).
 * Renders the correct form based on the formType prop.
 */

'use client';

import { useEffect, useState } from 'react';
import SearchableSelect from '@/components/ui/SearchableSelect';

interface CandidateOption { id: number; applicationNo: string; firstName: string; lastName: string; }
interface Nominee { nomineeName: string; relationship: string; age?: number | null; proportion?: number | null; }

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' } as const;
const labelClass = 'block text-sm font-medium mb-1';

export default function StatutoryForm({ formType }: { formType: string }) {
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recruitment/candidates?limit=50').then((r) => r.json()).then((j) => setCandidates(j.data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedCandidate) { setData(null); return; }
    setLoading(true);
    fetch(`/api/recruitment/statutory-forms?candidateId=${selectedCandidate}&formType=${formType}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [selectedCandidate, formType]);

  const candidateOptions = candidates.map((c) => ({ label: `${c.applicationNo} — ${c.firstName} ${c.lastName}`, value: c.id }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const save = async (formData: any) => {
    if (!selectedCandidate) { setError('Select a candidate'); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/recruitment/statutory-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, formType, candidateId: Number(selectedCandidate) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setData(json);
      setSuccess('Saved successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<string, string> = {
    'joining-form': 'Application / Joining Form (§7.2)',
    'joining-report': 'Joining Report (§7.3)',
    'gratuity': 'Gratuity Nomination Form F (§7.4)',
    'pf': 'PF Nomination Form 2 (§7.5)',
    'esi': 'ESI Application Form 1 (§7.6)',
    'insurance': 'Insurance Form (§7.7)',
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{error}</div>}
      {success && <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>{success}</div>}

      <div className="max-w-md">
        <label className={labelClass} style={{ color: 'var(--foreground)' }}>Select Candidate</label>
        <SearchableSelect value={selectedCandidate} options={candidateOptions} onChange={(v) => setSelectedCandidate(String(v))} placeholder="Search candidate..." />
      </div>

      {loading && <div className="p-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading...</div>}

      {selectedCandidate && !loading && (
        <div className="card p-5 space-y-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{titles[formType] ?? formType}</h3>
          {formType === 'joining-form' && <JoiningFormFields data={data} onSave={save} saving={saving} />}
          {formType === 'joining-report' && <JoiningReportFields data={data} onSave={save} saving={saving} />}
          {formType === 'gratuity' && <GratuityFields data={data} onSave={save} saving={saving} />}
          {formType === 'pf' && <PfFields data={data} onSave={save} saving={saving} />}
          {formType === 'esi' && <EsiFields data={data} onSave={save} saving={saving} />}
          {formType === 'insurance' && <InsuranceFields data={data} onSave={save} saving={saving} />}
        </div>
      )}
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | number | null; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className={labelClass} style={{ color: 'var(--foreground)' }}>{label}</label>
      <input type={type} className={inputClass} style={inputStyle} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelClass} style={{ color: 'var(--foreground)' }}>{label}</label>
      <textarea className={inputClass} style={inputStyle} rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string | null; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <div>
      <label className={labelClass} style={{ color: 'var(--foreground)' }}>{label}</label>
      <select className={inputClass} style={inputStyle} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SaveButton({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
      <button onClick={onSave} disabled={saving} className="rounded-lg px-6 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Save Form'}
      </button>
    </div>
  );
}

// ─── Joining Form (§7.2) ───────────────────────────────────────────────────

function JoiningFormFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({
    postApplied: '', applicantName: '', fatherName: '', dateOfBirth: '', age: '',
    gender: '', nationality: '', religion: '', communicationAddress: '', permanentAddress: '',
    experience: '', languages: '', educationalQualification: '', technicalQualification: '',
    maritalStatus: '', email: '', bloodGroup: '', mobile: '',
  });
  useEffect(() => {
    if (data) setF({
      postApplied: data.postApplied ?? '', applicantName: data.applicantName ?? '',
      fatherName: data.fatherName ?? '', dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
      age: data.age ?? '', gender: data.gender ?? '', nationality: data.nationality ?? '',
      religion: data.religion ?? '', communicationAddress: data.communicationAddress ?? '',
      permanentAddress: data.permanentAddress ?? '', experience: data.experience ?? '',
      languages: data.languages ?? '', educationalQualification: data.educationalQualification ?? '',
      technicalQualification: data.technicalQualification ?? '', maritalStatus: data.maritalStatus ?? '',
      email: data.email ?? '', bloodGroup: data.bloodGroup ?? '', mobile: data.mobile ?? '',
    });
  }, [data]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Post Applied *" value={f.postApplied} onChange={(v) => set('postApplied', v)} />
        <Field label="Applicant Name *" value={f.applicantName} onChange={(v) => set('applicantName', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Father's Name" value={f.fatherName} onChange={(v) => set('fatherName', v)} />
        <Field label="Date of Birth" type="date" value={f.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
        <Field label="Age" type="number" value={f.age} onChange={(v) => set('age', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select label="Gender" value={f.gender} onChange={(v) => set('gender', v)} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
        <Field label="Nationality" value={f.nationality} onChange={(v) => set('nationality', v)} />
        <Field label="Religion" value={f.religion} onChange={(v) => set('religion', v)} />
      </div>
      <TextArea label="Communication Address" value={f.communicationAddress} onChange={(v) => set('communicationAddress', v)} />
      <TextArea label="Permanent Address" value={f.permanentAddress} onChange={(v) => set('permanentAddress', v)} />
      <TextArea label="Experience" value={f.experience} onChange={(v) => set('experience', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Languages" value={f.languages} onChange={(v) => set('languages', v)} />
        <Field label="Blood Group" value={f.bloodGroup} onChange={(v) => set('bloodGroup', v)} />
      </div>
      <TextArea label="Educational Qualification" value={f.educationalQualification} onChange={(v) => set('educationalQualification', v)} />
      <Field label="Technical Qualification" value={f.technicalQualification} onChange={(v) => set('technicalQualification', v)} />
      <div className="grid grid-cols-3 gap-3">
        <Select label="Marital Status" value={f.maritalStatus} onChange={(v) => set('maritalStatus', v)} options={[{ label: 'Single', value: 'Single' }, { label: 'Married', value: 'Married' }, { label: 'Divorced', value: 'Divorced' }]} />
        <Field label="Email" value={f.email} onChange={(v) => set('email', v)} />
        <Field label="Mobile" value={f.mobile} onChange={(v) => set('mobile', v)} />
      </div>
      <SaveButton onSave={() => onSave({ ...f, age: f.age ? Number(f.age) : null })} saving={saving} />
    </div>
  );
}

// ─── Joining Report (§7.3) ─────────────────────────────────────────────────

function JoiningReportFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({
    joiningDate: '', grade: '', bloodGroup: '', reportedTo: '', panNo: '',
    presentAddress: '', permanentAddress: '', contactNumber: '', emergencyContact: '', certificatesVerifiedBy: '',
  });
  useEffect(() => {
    if (data) setF({
      joiningDate: data.joiningDate ? data.joiningDate.slice(0, 10) : '',
      grade: data.grade ?? '', bloodGroup: data.bloodGroup ?? '', reportedTo: data.reportedTo ?? '',
      panNo: data.panNo ?? '', presentAddress: data.presentAddress ?? '', permanentAddress: data.permanentAddress ?? '',
      contactNumber: data.contactNumber ?? '', emergencyContact: data.emergencyContact ?? '', certificatesVerifiedBy: data.certificatesVerifiedBy ?? '',
    });
  }, [data]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Joining Date *" type="date" value={f.joiningDate} onChange={(v) => set('joiningDate', v)} />
        <Field label="Grade" value={f.grade} onChange={(v) => set('grade', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Blood Group" value={f.bloodGroup} onChange={(v) => set('bloodGroup', v)} />
        <Field label="Reported To" value={f.reportedTo} onChange={(v) => set('reportedTo', v)} />
      </div>
      <Field label="PAN No" value={f.panNo} onChange={(v) => set('panNo', v)} />
      <TextArea label="Present Address" value={f.presentAddress} onChange={(v) => set('presentAddress', v)} />
      <TextArea label="Permanent Address" value={f.permanentAddress} onChange={(v) => set('permanentAddress', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact Number *" value={f.contactNumber} onChange={(v) => set('contactNumber', v)} />
        <Field label="Emergency Contact" value={f.emergencyContact} onChange={(v) => set('emergencyContact', v)} />
      </div>
      <Field label="Certificates Verified By" value={f.certificatesVerifiedBy} onChange={(v) => set('certificatesVerifiedBy', v)} />
      <SaveButton onSave={() => onSave({ ...f })} saving={saving} />
    </div>
  );
}

// ─── Gratuity (§7.4) ────────────────────────────────────────────────────────

function GratuityFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({ employeeName: '', employerRefNo: '', sex: '', religion: '', maritalStatus: '', department: '', postHeld: '', appointmentDate: '', permanentAddress: '' });
  const [nominees, setNominees] = useState<Nominee[]>([]);
  useEffect(() => {
    if (data) {
      setF({
        employeeName: data.employeeName ?? '', employerRefNo: data.employerRefNo ?? '', sex: data.sex ?? '',
        religion: data.religion ?? '', maritalStatus: data.maritalStatus ?? '', department: data.department ?? '',
        postHeld: data.postHeld ?? '', appointmentDate: data.appointmentDate ? data.appointmentDate.slice(0, 10) : '',
        permanentAddress: data.permanentAddress ?? '',
      });
      setNominees(data.nominees ?? []);
    }
  }, [data]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const addNominee = () => setNominees([...nominees, { nomineeName: '', relationship: '', age: null, proportion: null }]);
  const updateNominee = (i: number, k: keyof Nominee, v: string | number | null) => { const n = [...nominees]; (n[i] as unknown as Record<string, unknown>)[k] = v; setNominees(n); };
  const removeNominee = (i: number) => setNominees(nominees.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee Name *" value={f.employeeName} onChange={(v) => set('employeeName', v)} />
        <Field label="Employer Ref No" value={f.employerRefNo} onChange={(v) => set('employerRefNo', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select label="Sex" value={f.sex} onChange={(v) => set('sex', v)} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]} />
        <Field label="Religion" value={f.religion} onChange={(v) => set('religion', v)} />
        <Field label="Marital Status" value={f.maritalStatus} onChange={(v) => set('maritalStatus', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Department" value={f.department} onChange={(v) => set('department', v)} />
        <Field label="Post Held" value={f.postHeld} onChange={(v) => set('postHeld', v)} />
        <Field label="Appointment Date" type="date" value={f.appointmentDate} onChange={(v) => set('appointmentDate', v)} />
      </div>
      <TextArea label="Permanent Address" value={f.permanentAddress} onChange={(v) => set('permanentAddress', v)} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Nominees</label>
          <button onClick={addNominee} className="text-xs font-medium px-2 py-1 rounded text-white" style={{ backgroundColor: 'var(--accent)' }}>+ Add</button>
        </div>
        {nominees.map((n, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={inputClass} style={inputStyle} placeholder="Name" value={n.nomineeName} onChange={(e) => updateNominee(i, 'nomineeName', e.target.value)} />
            <input className={inputClass} style={inputStyle} placeholder="Relationship" value={n.relationship} onChange={(e) => updateNominee(i, 'relationship', e.target.value)} />
            <input type="number" className={inputClass} style={inputStyle} placeholder="Age" value={n.age ?? ''} onChange={(e) => updateNominee(i, 'age', e.target.value ? Number(e.target.value) : null)} />
            <input type="number" className={inputClass} style={inputStyle} placeholder="Proportion %" value={n.proportion ?? ''} onChange={(e) => updateNominee(i, 'proportion', e.target.value ? Number(e.target.value) : null)} />
            <button onClick={() => removeNominee(i)} className="text-xs text-red-600 px-2">Remove</button>
          </div>
        ))}
      </div>
      <SaveButton onSave={() => onSave({ ...f, appointmentDate: f.appointmentDate || null, nominees: nominees.map((n) => ({ ...n, age: n.age || null, proportion: n.proportion || null })) })} saving={saving} />
    </div>
  );
}

// ─── PF (§7.5) ──────────────────────────────────────────────────────────────

function PfFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({ employeeName: '', aadhaar: '', mobile: '', uan: '' });
  const [nominees, setNominees] = useState<Nominee[]>([]);
  useEffect(() => {
    if (data) {
      setF({ employeeName: data.employeeName ?? '', aadhaar: data.aadhaar ?? '', mobile: data.mobile ?? '', uan: data.uan ?? '' });
      setNominees(data.nominees ?? []);
    }
  }, [data]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const addNominee = () => setNominees([...nominees, { nomineeName: '', relationship: '', age: null, proportion: null }]);
  const updateNominee = (i: number, k: keyof Nominee, v: string | number | null) => { const n = [...nominees]; (n[i] as unknown as Record<string, unknown>)[k] = v; setNominees(n); };
  const removeNominee = (i: number) => setNominees(nominees.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee Name *" value={f.employeeName} onChange={(v) => set('employeeName', v)} />
        <Field label="Aadhaar" value={f.aadhaar} onChange={(v) => set('aadhaar', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile" value={f.mobile} onChange={(v) => set('mobile', v)} />
        <Field label="UAN" value={f.uan} onChange={(v) => set('uan', v)} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Nominees</label>
          <button onClick={addNominee} className="text-xs font-medium px-2 py-1 rounded text-white" style={{ backgroundColor: 'var(--accent)' }}>+ Add</button>
        </div>
        {nominees.map((n, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={inputClass} style={inputStyle} placeholder="Name" value={n.nomineeName} onChange={(e) => updateNominee(i, 'nomineeName', e.target.value)} />
            <input className={inputClass} style={inputStyle} placeholder="Relationship" value={n.relationship} onChange={(e) => updateNominee(i, 'relationship', e.target.value)} />
            <input type="number" className={inputClass} style={inputStyle} placeholder="Age" value={n.age ?? ''} onChange={(e) => updateNominee(i, 'age', e.target.value ? Number(e.target.value) : null)} />
            <input type="number" className={inputClass} style={inputStyle} placeholder="Proportion %" value={n.proportion ?? ''} onChange={(e) => updateNominee(i, 'proportion', e.target.value ? Number(e.target.value) : null)} />
            <button onClick={() => removeNominee(i)} className="text-xs text-red-600 px-2">Remove</button>
          </div>
        ))}
      </div>
      <SaveButton onSave={() => onSave({ ...f, nominees: nominees.map((n) => ({ ...n, age: n.age || null, proportion: n.proportion || null })) })} saving={saving} />
    </div>
  );
}

// ─── ESI (§7.6) ─────────────────────────────────────────────────────────────

function EsiFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({
    applicable: true, ipNumber: '', mobile: '', dateOfJoining: '', aadhaar: '', aadhaarMobile: '',
    dateOfBirth: '', presentAddress: '', nomineeDetails: '', bankIfsc: '', bankAccount: '', reasonIfNotApplicable: '',
  });
  useEffect(() => {
    if (data) setF({
      applicable: data.applicable ?? true, ipNumber: data.ipNumber ?? '', mobile: data.mobile ?? '',
      dateOfJoining: data.dateOfJoining ? data.dateOfJoining.slice(0, 10) : '', aadhaar: data.aadhaar ?? '',
      aadhaarMobile: data.aadhaarMobile ?? '', dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
      presentAddress: data.presentAddress ?? '', nomineeDetails: data.nomineeDetails ?? '', bankIfsc: data.bankIfsc ?? '',
      bankAccount: data.bankAccount ?? '', reasonIfNotApplicable: data.reasonIfNotApplicable ?? '',
    });
  }, [data]);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={f.applicable} onChange={(e) => set('applicable', e.target.checked)} />
        ESI Applicable
      </label>
      {f.applicable ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IP Number" value={f.ipNumber} onChange={(v) => set('ipNumber', v)} />
            <Field label="Mobile" value={f.mobile} onChange={(v) => set('mobile', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Joining" type="date" value={f.dateOfJoining} onChange={(v) => set('dateOfJoining', v)} />
            <Field label="Date of Birth" type="date" value={f.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aadhaar" value={f.aadhaar} onChange={(v) => set('aadhaar', v)} />
            <Field label="Aadhaar-linked Mobile" value={f.aadhaarMobile} onChange={(v) => set('aadhaarMobile', v)} />
          </div>
          <TextArea label="Present Address" value={f.presentAddress} onChange={(v) => set('presentAddress', v)} />
          <TextArea label="Nominee Details" value={f.nomineeDetails} onChange={(v) => set('nomineeDetails', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank IFSC" value={f.bankIfsc} onChange={(v) => set('bankIfsc', v)} />
            <Field label="Bank Account" value={f.bankAccount} onChange={(v) => set('bankAccount', v)} />
          </div>
        </>
      ) : (
        <TextArea label="Reason (if not applicable)" value={f.reasonIfNotApplicable} onChange={(v) => set('reasonIfNotApplicable', v)} />
      )}
      <SaveButton onSave={() => onSave({ ...f, dateOfJoining: f.dateOfJoining || null, dateOfBirth: f.dateOfBirth || null })} saving={saving} />
    </div>
  );
}

// ─── Insurance (§7.7) ──────────────────────────────────────────────────────

function InsuranceFields({ data, onSave, saving }: { /* eslint-disable @typescript-eslint/no-explicit-any */ data: any; onSave: (d: any) => void /* eslint-enable */; saving: boolean }) {
  const [f, setF] = useState({
    employeeName: '', policyNo: '', provider: '', coverageType: '', coverageAmount: '',
    premiumAmount: '', nomineeName: '', nomineeRelationship: '', nomineeAge: '', nomineeAddress: '', dependentsCovered: '',
    employeeSignatureUrl: '', hrVerificationUrl: '', status: 'Pending',
  });
  useEffect(() => {
    if (data) setF({
      employeeName: data.employeeName ?? '', policyNo: data.policyNo ?? '', provider: data.provider ?? '',
      coverageType: data.coverageType ?? '', coverageAmount: data.coverageAmount ?? '', premiumAmount: data.premiumAmount ?? '',
      nomineeName: data.nomineeName ?? '', nomineeRelationship: data.nomineeRelationship ?? '', nomineeAge: data.nomineeAge ?? '',
      nomineeAddress: data.nomineeAddress ?? '', dependentsCovered: data.dependentsCovered ?? '',
      employeeSignatureUrl: data.employeeSignatureUrl ?? '', hrVerificationUrl: data.hrVerificationUrl ?? '',
      status: data.status ?? 'Pending',
    });
  }, [data]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Insurance enrollment form (BRD §7.7). Fields designed per BRD — company can adjust later.
          On joining, this links to Employee Master → Health Insurance Config.
        </p>
      </div>
      <Field label="Employee Name *" value={f.employeeName} onChange={(v) => set('employeeName', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Policy No *" value={f.policyNo} onChange={(v) => set('policyNo', v)} />
        <Field label="Provider *" value={f.provider} onChange={(v) => set('provider', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select label="Coverage Type *" value={f.coverageType} onChange={(v) => set('coverageType', v)} options={[
          { label: 'Health', value: 'Health' }, { label: 'Life', value: 'Life' }, { label: 'Accident', value: 'Accident' }, { label: 'Group Medical', value: 'Group Medical' },
        ]} />
        <Field label="Coverage Amount *" type="number" value={f.coverageAmount} onChange={(v) => set('coverageAmount', v)} />
        <Field label="Premium Amount" type="number" value={f.premiumAmount} onChange={(v) => set('premiumAmount', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Nominee Name *" value={f.nomineeName} onChange={(v) => set('nomineeName', v)} />
        <Field label="Nominee Relationship *" value={f.nomineeRelationship} onChange={(v) => set('nomineeRelationship', v)} />
        <Field label="Nominee Age *" type="number" value={f.nomineeAge} onChange={(v) => set('nomineeAge', v)} />
      </div>
      <TextArea label="Nominee Address *" value={f.nomineeAddress} onChange={(v) => set('nomineeAddress', v)} />
      <TextArea label="Dependents Covered (Names + Aadhaar for endorsement)" value={f.dependentsCovered} onChange={(v) => set('dependentsCovered', v)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee Signature URL" value={f.employeeSignatureUrl} onChange={(v) => set('employeeSignatureUrl', v)} placeholder="Upload signature → URL" />
        <Field label="HR Verification URL" value={f.hrVerificationUrl} onChange={(v) => set('hrVerificationUrl', v)} placeholder="Upload HR sign-off → URL" />
      </div>
      <Select label="Status" value={f.status} onChange={(v) => set('status', v)} options={[
        { label: 'Pending', value: 'Pending' }, { label: 'Verified', value: 'Verified' }, { label: 'Submitted', value: 'Submitted' },
      ]} />
      <SaveButton onSave={() => onSave({ ...f, coverageAmount: f.coverageAmount ? Number(f.coverageAmount) : null, premiumAmount: f.premiumAmount ? Number(f.premiumAmount) : null, nomineeAge: f.nomineeAge ? Number(f.nomineeAge) : null })} saving={saving} />
    </div>
  );
}
