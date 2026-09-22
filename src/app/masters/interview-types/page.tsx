import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Interview Types"
      apiPath="/api/masters/interview-types"
      codeLabel="Type Code"
      nameLabel="Type Name"
    />
  );
}
