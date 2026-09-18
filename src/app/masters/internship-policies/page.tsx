import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Internship Policies"
      apiPath="/api/masters/internship-policies"
      codeLabel="Policy Code"
      nameLabel="Policy Name"
    />
  );
}
