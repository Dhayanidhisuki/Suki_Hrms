import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Document Types"
      apiPath="/api/masters/document-types"
      codeLabel="Doc Code"
      nameLabel="Doc Name"
    />
  );
}
