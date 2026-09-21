import { redirect } from 'next/navigation';

/** Goal templates now live under Performance. */
export default function Page() {
  redirect('/performance/goal-templates');
}
