/**
 * Cost Centre master (BRD 01 §5.2) — independent financial dimension; the
 * ccCode is supplied by Finance and is the key the accounting interface
 * books payroll cost against. Owning department + budget owner are refs.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';
import type { FieldDef, FieldOption } from '@/components/ui';

interface DepartmentRef { id: number; code: string; name: string }
interface EmployeeRef { id: number; firstName: string; lastName: string; employeeCode: string; oldEmployeeCode: string | null }

export default function CostCentresPage() {
  const [departmentOptions, setDepartmentOptions] = useState<FieldOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<FieldOption[]>([]);

  const loadOptions = useCallback(() => {
    fetch('/api/masters/departments?limit=500')
      .then(async (res) => (res.ok ? ((await res.json()) as { data: DepartmentRef[] }) : { data: [] }))
      .then((json) => setDepartmentOptions(json.data.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))))
      .catch(() => setDepartmentOptions([]));
    fetch('/api/employees?limit=500')
      .then(async (res) => (res.ok ? ((await res.json()) as { data: EmployeeRef[] }) : { data: [] }))
      .then((json) =>
        setEmployeeOptions(json.data.map((e) => ({ label: `${e.firstName} ${e.lastName} (${e.oldEmployeeCode ?? e.employeeCode})`, value: e.id })))
      )
      .catch(() => setEmployeeOptions([]));
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const extraFields: FieldDef[] = [
    { name: 'departmentId', label: 'Owning Department', type: 'select', options: departmentOptions },
    { name: 'ownerEmpId', label: 'Budget Owner', type: 'select', options: employeeOptions, helpText: 'Optional — search by name or code' },
  ];

  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Organization" />
      <SimpleMasterPage
        title="Cost Centres"
        apiPath="/api/masters/cost-centres"
        addLabel="Add Cost Centre"
        codeLabel="CC Code"
        extraFields={extraFields}
        extraColumns={[
          {
            key: 'department',
            label: 'Department',
            render: (row) => {
              const d = row.department as DepartmentRef | null;
              return d ? d.name : '—';
            },
          },
          {
            key: 'owner',
            label: 'Budget Owner',
            render: (row) => {
              const o = row.owner as { firstName: string; lastName: string; employeeCode: string } | null;
              return o ? `${o.firstName} ${o.lastName} (${o.employeeCode})` : '—';
            },
          },
        ]}
        extraInitialValues={(row) => ({
          departmentId: (row.departmentId as number | null) ?? '',
          ownerEmpId: (row.ownerEmpId as number | null) ?? '',
        })}
      />
    </div>
  );
}
