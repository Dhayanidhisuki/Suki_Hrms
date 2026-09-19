import { redirect } from 'next/navigation';

/** Folded into Offer & Joining — keep old links working. */
export default function Page() {
  redirect('/recruitment/offer-joining?tab=offer');
}
