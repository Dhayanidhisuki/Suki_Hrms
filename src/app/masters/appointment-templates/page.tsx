import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Appointment Order Templates"
      apiPath="/api/masters/appointment-templates"
      codeLabel="Template Code"
      nameLabel="Template Name"
    />
  );
}
