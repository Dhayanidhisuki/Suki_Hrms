import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

export default function EmployeeTypesPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Employee" />
      <SimpleMasterPage statsModule="employee-types" title="Employee Types" apiPath="/api/masters/employee-types" autoCode />
    </div>
  );
}
