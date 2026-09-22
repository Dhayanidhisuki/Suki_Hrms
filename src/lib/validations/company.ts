/**
 * Zod validation schema for the Company master.
 * Same shape as the simple masters (code + name + description + isActive).
 */

import { z } from 'zod';

export const companySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  // Registered address + contact — printed on the letterhead of every
  // generated document. Optional so existing companies stay valid.
  addressLine1: z.string().max(150).optional().nullable(),
  addressLine2: z.string().max(150).optional().nullable(),
  city: z.string().max(60).optional().nullable(),
  state: z.string().max(60).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  isActive: z.boolean().default(true),
});
