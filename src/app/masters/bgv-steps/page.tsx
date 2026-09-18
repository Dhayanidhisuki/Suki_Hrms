import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="BGV Steps"
      apiPath="/api/masters/bgv-steps"
      codeLabel="Step Code"
      nameLabel="Step Name"
    />
  );
}
