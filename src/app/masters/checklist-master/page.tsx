import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Checklist Master"
      apiPath="/api/masters/checklist-master"
      codeLabel="Item Code"
      nameLabel="Item Name"
    />
  );
}
