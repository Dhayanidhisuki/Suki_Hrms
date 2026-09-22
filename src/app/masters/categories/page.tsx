import SimpleMasterPage from '@/components/SimpleMasterPage';
import MasterGroupTabs from '@/components/masters/MasterGroupTabs';

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <MasterGroupTabs groupLabel="Employee" />
      <SimpleMasterPage statsModule="categories" title="Categories" apiPath="/api/masters/categories" autoCode />
    </div>
  );
}
