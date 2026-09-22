import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Interview Criteria"
      apiPath="/api/masters/interview-criteria"
      codeLabel="Criteria Code"
      nameLabel="Criteria Name"
    />
  );
}
