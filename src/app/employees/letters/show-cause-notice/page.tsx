'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="SHOW_CAUSE"
      title="Show cause notice"
      description="Requires a written explanation by the stated deadline."
      ownerKind="EMPLOYEE"
    />
  );
}
