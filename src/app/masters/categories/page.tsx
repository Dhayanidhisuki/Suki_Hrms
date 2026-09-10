import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function CategoriesPage() {
  return <SimpleMasterPage statsModule="categories" title="Categories" apiPath="/api/masters/categories" autoCode />;
}
