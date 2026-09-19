import SimpleMasterPage from '@/components/SimpleMasterPage';

export default function Page() {
  return (
    <SimpleMasterPage
      title="Offer Letter Templates"
      apiPath="/api/masters/offer-templates"
      codeLabel="Template Code"
      nameLabel="Template Name"
    />
  );
}
