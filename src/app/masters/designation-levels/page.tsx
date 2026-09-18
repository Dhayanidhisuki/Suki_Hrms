import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Designation Levels"
      apiPath="/api/masters/designation-levels"
      codeLabel="Level Code"
      nameLabel="Level Name"
    />
  );
}
