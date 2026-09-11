import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function EmployeeTypesPage() {
  return <SimpleMasterPage statsModule="employee-types" title="Employee Types" apiPath="/api/masters/employee-types" autoCode />;
}
