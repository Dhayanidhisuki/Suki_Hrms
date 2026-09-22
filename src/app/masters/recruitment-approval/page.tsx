import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Recruitment Approval Matrix"
      apiPath="/api/masters/recruitment-approval-matrix"
      codeLabel="Matrix Code"
      nameLabel="Process"
    />
  );
}
