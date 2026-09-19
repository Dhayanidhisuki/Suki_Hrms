import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Score & Weightage"
      apiPath="/api/masters/interview-score-configs"
      codeLabel="Config Code"
      nameLabel="Config"
    />
  );
}
