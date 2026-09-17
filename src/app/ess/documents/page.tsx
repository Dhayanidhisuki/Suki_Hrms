'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';
import EmployeeDocumentsTab from '@/components/employees/EmployeeDocumentsTab';

export default function EssDocumentsPage() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [label, setLabel] = useState('My documents');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => {
        if (typeof me.employeeId !== 'number') {
          setError('No employee record is linked to this login, so self-service documents are not available.');
          return;
        }
        setEmployeeId(me.employeeId);
        setLabel(me.employeeCode ? `${me.employeeCode} — ${me.employeeName ?? ''}`.trim() : 'My documents');
      })
      .catch(() => setError('Could not load your profile'));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Self Service"
        title="My documents"
        description="Upload identity files for HR to verify. Download verified copies. You cannot upload HR-only letters or payroll files."
      />
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      {employeeId != null && <EmployeeDocumentsTab employeeId={String(employeeId)} employeeLabel={label} />}
    </div>
  );
}
