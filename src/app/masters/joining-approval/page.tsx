import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Joining Approval Matrix"
      apiPath="/api/masters/joining-approval-matrix"
      codeLabel="Matrix Code"
      nameLabel="Matrix"
    />
  );
}
