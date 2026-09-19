import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Other Joining Document Types"
      apiPath="/api/masters/other-joining-doc-types"
      codeLabel="Doc Code"
      nameLabel="Document Name"
    />
  );
}
