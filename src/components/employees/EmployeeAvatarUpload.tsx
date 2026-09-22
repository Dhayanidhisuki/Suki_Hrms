/**
 * Editable profile photo — wraps EmployeeAvatar with a camera-icon overlay
 * (upload) and, once a photo exists, a small remove button. Used only on
 * the employee profile header; every other place (lists, dialogs) uses the
 * plain read-only EmployeeAvatar.
 */

'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/ui';
import EmployeeAvatar from './EmployeeAvatar';

interface Props {
  employeeId: number;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  size?: number;
  /** Called with the new path (or null after a remove) once the server confirms it. */
  onChanged: (photoPath: string | null) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = '.jpg,.jpeg,.png,.webp';

const CameraIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function EmployeeAvatarUpload({ employeeId, firstName, lastName, photoPath, size = 88, onChanged }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error('File too large — max 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      onChanged(json.profilePhotoPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Remove failed');
      onChanged(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      <EmployeeAvatar firstName={firstName} lastName={lastName} photoPath={photoPath} size={size} />

      {busy && (
        <div
          className="absolute inset-0 grid place-items-center rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}

      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        aria-label={photoPath ? 'Change profile photo' : 'Upload profile photo'}
        title={photoPath ? 'Change profile photo' : 'Upload profile photo'}
        className="absolute bottom-0 right-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)', border: '2px solid var(--surface)' }}
      >
        <CameraIcon />
      </button>

      {photoPath && !busy && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove profile photo"
          title="Remove profile photo"
          className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-white shadow-md transition hover:opacity-90"
          style={{ backgroundColor: 'var(--danger)', border: '2px solid var(--surface)' }}
        >
          <TrashIcon />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

    </div>
  );
}
