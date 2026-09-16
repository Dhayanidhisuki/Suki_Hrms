import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Interview Panel"
      apiPath="/api/masters/interview-panels"
      codeLabel="Panel Code"
      nameLabel="Panel"
    />
  );
}
