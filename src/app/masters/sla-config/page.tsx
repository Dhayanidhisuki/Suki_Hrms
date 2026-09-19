import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="SLA Config"
      apiPath="/api/masters/sla-configs"
      codeLabel="Stage Code"
      nameLabel="Stage Name"
    />
  );
}
