import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Email Templates"
      apiPath="/api/masters/email-templates"
      codeLabel="Template Code"
      nameLabel="Template Name"
    />
  );
}
