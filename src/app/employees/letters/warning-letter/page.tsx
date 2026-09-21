'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="WARNING_LETTER"
      title="Warning letter"
      description="Disciplinary warning; archived under Letters & Certificates."
      ownerKind="EMPLOYEE"
    />
  );
}
