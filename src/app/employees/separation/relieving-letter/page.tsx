'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="COMPANY_RELIEVING"
      title="Relieving letter"
      description="Issued on separation and archived on the employee record."
      ownerKind="EMPLOYEE"
    />
  );
}
