'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="SERVICE_LETTER"
      title="Service letter"
      description="Service certificate for current or relieved employees."
      ownerKind="EMPLOYEE"
    />
  );
}
