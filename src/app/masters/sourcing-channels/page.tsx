import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Sourcing Channels"
      apiPath="/api/masters/sourcing-channels"
      codeLabel="Channel Code"
      nameLabel="Channel Name"
    />
  );
}
