/**
 * Company identity for document letterheads.
 *
 * Every generated PDF (payslip, F&F statement, HR letters) prints the issuing
 * company's name and registered address. Both now come from the Company
 * record. Previously the address was a hard-coded KUN constant, and the F&F
 * statement additionally regex-sniffed Company.description to guess whether it
 * held something address-shaped — so a second company would have printed KUN's
 * address on its own letters.
 */

import { prisma } from '@/lib/prisma';

export type CompanyProfile = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
};

type AddressParts = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  description?: string | null;
};

/**
 * One address line from the structured columns.
 *
 * Falls back to `description` for companies created before the address columns
 * existed, where admins put the address there — that is a fallback, not the
 * source of truth, and it disappears as soon as the real fields are filled in.
 */
export function formatCompanyAddress(c: AddressParts): string {
  const street = [c.addressLine1, c.addressLine2].map((p) => p?.trim()).filter(Boolean).join(', ');
  const locality = [c.city, c.state].map((p) => p?.trim()).filter(Boolean).join(', ');
  const pin = c.pincode?.trim();
  // The pin hangs off the locality ("Chennai, Tamil Nadu - 600058"), but with
  // no city or state it has to stand alone rather than leave a dangling " - ".
  const withPin = pin ? (locality ? `${locality} - ${pin}` : pin) : locality;
  const full = [street, withPin].filter(Boolean).join(', ');
  if (full) return full;
  return c.description?.trim() ?? '';
}

export async function loadCompanyProfile(companyId: number): Promise<CompanyProfile | null> {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      description: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    address: formatCompanyAddress(c),
    phone: c.phone,
    email: c.email,
  };
}
