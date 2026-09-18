import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Recruitment Status"
      apiPath="/api/masters/recruitment-status"
      codeLabel="Status Code"
      nameLabel="Status Name"
    />
  );
}
