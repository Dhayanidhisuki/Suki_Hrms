/**
 * Offer Letter sequence generator — HRM/OFL/YYYY/NNNN format (BRD §5.15).
 */

import { prisma } from '@/lib/prisma';

const OFFER_SEQ_KEY = 'offer-letter';

export function formatOfferNo(year: number, n: number): string {
  return `HRM/OFL/${year}/${String(n).padStart(4, '0')}`;
}

export async function allocateOfferNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await prisma.employeeIdSequence.upsert({
    where: { counterKey: OFFER_SEQ_KEY },
    create: { counterKey: OFFER_SEQ_KEY, lastNumber: 0 },
    update: {},
  });

  let n = seq.lastNumber;
  for (let i = 0; i < 10000; i += 1) {
    n += 1;
    const offerNo = formatOfferNo(year, n);
    const taken = await prisma.offerLetter.findFirst({ where: { offerNo: offerNo }, select: { id: true } });
    if (!taken) {
      await prisma.employeeIdSequence.update({
        where: { counterKey: OFFER_SEQ_KEY },
        data: { lastNumber: n },
      });
      return offerNo;
    }
  }
  throw new Error('Could not allocate offer number after 10000 attempts');
}

/**
 * Render an offer template body with candidate/offer data.
 * Simple {{variable}} placeholder replacement.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}
