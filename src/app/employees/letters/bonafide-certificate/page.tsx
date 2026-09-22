'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="BONAFIDE"
      title="Bonafide certificate"
      description="Issued for a stated purpose (loan, visa, etc.)."
      ownerKind="EMPLOYEE"
    />
  );
}
