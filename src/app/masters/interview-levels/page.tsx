import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Interview Levels"
      apiPath="/api/masters/interview-levels"
      codeLabel="Level Code"
      nameLabel="Level Name"
    />
  );
}
