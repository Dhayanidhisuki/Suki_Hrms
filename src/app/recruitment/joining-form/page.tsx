import { redirect } from 'next/navigation';

/** Folded into Offer & Joining > Joining sub-tab — keep old links working. */
export default function Page() {
  redirect('/recruitment/offer-joining?tab=joining&sub=application');
}
