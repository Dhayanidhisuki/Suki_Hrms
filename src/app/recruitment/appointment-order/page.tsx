'use client';
import LetterIssuePage from '@/components/letters/LetterIssuePage';
export default function Page() {
  return (
    <LetterIssuePage
      letterType="APPOINTMENT_LETTER"
      title="Appointment order"
      description="Issue KAPLHR/Appt numbering and archive the PDF on the employee."
      ownerKind="EMPLOYEE"
    />
  );
}
