'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="OFFER_LETTER"
      title="Offer letter"
      description="Issue HRM/OFL numbering. The PDF is stored on the candidate in the Document Module."
      ownerKind="CANDIDATE"
    />
  );
}
