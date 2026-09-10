import { redirect } from 'next/navigation';

/** Folded into the combined Designations & Grades page — keep old links working. */
export default function Page() {
  redirect('/masters/designations-grades?tab=designations');
}
