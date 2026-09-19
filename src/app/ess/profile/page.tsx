/**
 * Employee Self Service — Profile. View own basic/personal/bank/KYC (masked,
 * view-only) and self-edit address/contact + emergency contacts (applies
 * immediately, no HR approval).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ContactDetails {
  permanentAddressLine1: string;
  permanentAddressLine2: string | null;
  permanentCity: string;
  permanentState: string;
  permanentPincode: string;
  permanentMobile: string;
  sameAsPermanent: boolean;
  presentAddressLine1: string | null;
  presentAddressLine2: string | null;
  presentCity: string | null;
  presentState: string | null;
  presentPincode: string | null;
  presentMobile: string | null;
}

interface EmergencyContact {
  id: number;
  contactName: string;
  relationship: string;
  phoneNumber: string;
  isPrimary: boolean;
}

interface Profile {
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: string;
  companyName: string | null;
  joinDate: string | null;
  department: string | null;
  designation: string | null;
  personalDetails: Record<string, unknown> | null;
  contactDetails: ContactDetails | null;
  emergencyContacts: EmergencyContact[];
  bank: { bankName: string; accountNumber: string; ifscCode: string } | null;
  pan: string | null;
  aadhaar: string | null;
}

const EMPTY_CONTACT: ContactDetails = {
  permanentAddressLine1: '',
  permanentAddressLine2: '',
  permanentCity: '',
  permanentState: '',
  permanentPincode: '',
  permanentMobile: '',
  sameAsPermanent: false,
  presentAddressLine1: '',
  presentAddressLine2: '',
  presentCity: '',
  presentState: '',
  presentPincode: '',
  presentMobile: '',
};

const EMPTY_EMERGENCY = { contactName: '', relationship: '', phoneNumber: '', isPrimary: false };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{value || '—'}</div>
    </div>
  );
}

export default function EssProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [contactForm, setContactForm] = useState<ContactDetails>(EMPTY_CONTACT);
  const [newContact, setNewContact] = useState(EMPTY_EMERGENCY);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workforce/my-profile');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load profile');
      }
      const json: Profile = await res.json();
      setProfile(json);
      setContactForm(json.contactDetails ?? EMPTY_CONTACT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/workforce/my-profile/contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to save');
      }
      setMessage('Address/contact updated.');
      await fetchProfile();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function addEmergencyContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/workforce/my-profile/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to add contact');
      }
      setNewContact(EMPTY_EMERGENCY);
      setMessage('Emergency contact added.');
      await fetchProfile();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmergencyContact(id: number) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/workforce/my-profile/emergency-contacts?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to delete contact');
      }
      await fetchProfile();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete contact');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--foreground)', borderColor: 'var(--border)' };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>My Profile</h1>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      {loading || !profile ? (
        <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Loading…</div>
      ) : (
        <>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Basic Details</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Employee Code" value={profile.employeeCode} />
              <Field label="Name" value={[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')} />
              <Field label="Status" value={profile.status} />
              <Field label="Company" value={profile.companyName} />
              <Field label="Department" value={profile.department} />
              <Field label="Designation" value={profile.designation} />
              <Field label="Join Date" value={profile.joinDate ? new Date(profile.joinDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) : null} />
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Bank &amp; Statutory (view only — contact HR to change)</div>
            {!profile.bank && !profile.pan && !profile.aadhaar ? (
              // All five fields rendering as "—" reads like a failed load. Say
              // plainly that nothing is on record, and who can add it.
              <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.06)', color: 'var(--foreground-muted)' }}>
                No bank or statutory details are on record for you yet. Contact HR to have them added — they cannot be entered from Self Service.
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Bank Name" value={profile.bank?.bankName} />
              <Field label="Account Number" value={profile.bank?.accountNumber} />
              <Field label="IFSC" value={profile.bank?.ifscCode} />
              <Field label="PAN" value={profile.pan} />
              <Field label="Aadhaar" value={profile.aadhaar} />
            </div>
            )}
          </div>

          <form onSubmit={saveContact} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Address &amp; Contact</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>Permanent Address</div>
              <input className={inputClass} style={inputStyle} placeholder="Address line 1" value={contactForm.permanentAddressLine1 ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentAddressLine1: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="Address line 2" value={contactForm.permanentAddressLine2 ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentAddressLine2: e.target.value })} />
              <input className={inputClass} style={inputStyle} placeholder="City" value={contactForm.permanentCity ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentCity: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="State" value={contactForm.permanentState ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentState: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="Pincode" value={contactForm.permanentPincode ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentPincode: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="Mobile" value={contactForm.permanentMobile ?? ''} onChange={(e) => setContactForm({ ...contactForm, permanentMobile: e.target.value })} required />

              <label className="sm:col-span-2 flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" checked={contactForm.sameAsPermanent} onChange={(e) => setContactForm({ ...contactForm, sameAsPermanent: e.target.checked })} />
                Present address same as permanent
              </label>

              {!contactForm.sameAsPermanent && (
                <>
                  <div className="sm:col-span-2 text-xs font-semibold uppercase" style={{ color: 'var(--foreground-muted)' }}>Present Address</div>
                  <input className={inputClass} style={inputStyle} placeholder="Address line 1" value={contactForm.presentAddressLine1 ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentAddressLine1: e.target.value })} />
                  <input className={inputClass} style={inputStyle} placeholder="Address line 2" value={contactForm.presentAddressLine2 ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentAddressLine2: e.target.value })} />
                  <input className={inputClass} style={inputStyle} placeholder="City" value={contactForm.presentCity ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentCity: e.target.value })} />
                  <input className={inputClass} style={inputStyle} placeholder="State" value={contactForm.presentState ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentState: e.target.value })} />
                  <input className={inputClass} style={inputStyle} placeholder="Pincode" value={contactForm.presentPincode ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentPincode: e.target.value })} />
                  <input className={inputClass} style={inputStyle} placeholder="Mobile" value={contactForm.presentMobile ?? ''} onChange={(e) => setContactForm({ ...contactForm, presentMobile: e.target.value })} />
                </>
              )}
            </div>
            <button type="submit" disabled={saving} className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
              {saving ? 'Saving…' : 'Save Address'}
            </button>
          </form>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Emergency Contacts</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase" style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Relationship</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Primary</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {profile.emergencyContacts.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-4 text-center" style={{ color: 'var(--foreground-muted)' }}>No emergency contacts added.</td></tr>
                )}
                {profile.emergencyContacts.map((c) => (
                  <tr key={c.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-2 py-2">{c.contactName}</td>
                    <td className="px-2 py-2">{c.relationship}</td>
                    <td className="px-2 py-2">{c.phoneNumber}</td>
                    <td className="px-2 py-2">{c.isPrimary ? 'Yes' : ''}</td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => deleteEmergencyContact(c.id)} disabled={saving} className="text-xs text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <form onSubmit={addEmergencyContact} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end">
              <input className={inputClass} style={inputStyle} placeholder="Name" value={newContact.contactName} onChange={(e) => setNewContact({ ...newContact, contactName: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="Relationship" value={newContact.relationship} onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })} required />
              <input className={inputClass} style={inputStyle} placeholder="Phone" value={newContact.phoneNumber} onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })} required />
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" checked={newContact.isPrimary} onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })} />
                Primary
              </label>
              <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
                Add Contact
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
