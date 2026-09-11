import { z } from 'zod';
import { randomBytes } from 'crypto';

/**
 * Shared validation for visitor gate pass create/update.
 * Reference image fields: status, type, gate pass no, gate pass date,
 * mobile, visitor name, visitor type, party, email, address, visit date,
 * planned in/out time, person to meet, no of persons, food, gadgets, purpose.
 */
const VISITOR_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;

export const gatePassSchema = z.object({
  passType: z.enum(['GATE_PASS', 'WORK_PERMIT']),
  status: z.enum(VISITOR_STATUSES).default('DRAFT'),
  visitorName: z.string().min(1).max(100),
  mobileNo: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
  mobilePrefix: z.string().max(5).default('+91'),
  visitorTypeValue: z.string().min(1).max(100),
  partyName: z.string().max(200).optional().or(z.literal('')),
  email: z.string().email().max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  identityProofType: z.string().max(50).optional().or(z.literal('')),
  identityProofNumber: z.string().max(100).optional().or(z.literal('')),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/), // ISO-ish local
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/),
  plannedInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal('')),
  plannedOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal('')),
  personToMeetId: z.coerce.number().int().positive(),
  noOfPersons: z.coerce.number().int().min(1).default(1),
  purposeValue: z.string().min(1).max(100),
  remarks: z.string().max(500).optional().or(z.literal('')),
  vehicleNumber: z.string().max(20).optional().or(z.literal('')),
  vehicleType: z.string().max(50).optional().or(z.literal('')),
  driverName: z.string().max(100).optional().or(z.literal('')),
  driverMobile: z.string().regex(/^\d{10}$/, 'Driver mobile must be 10 digits').optional().or(z.literal('')),
  foodRequired: z.union([z.boolean(), z.enum(['YES', 'NO'])]).transform((v) => v === true || v === 'YES'),
  foodCategory: z.string().max(50).optional().or(z.literal('')),
  foodType: z.string().max(50).optional().or(z.literal('')),
  gadgets: z.string().max(50).optional().or(z.literal('')),
  qrValidMinutes: z.coerce.number().int().min(1).default(1440),
});

export type GatePassInput = z.infer<typeof gatePassSchema>;

/**
 * Generate a unique gate pass number: GPN/<TYPE-VALUE>/<NNNN>
 * scoped to the company. e.g. GPN/CONSULTANT/0001
 */
export async function generateGatePassNo(
  tx: { visitorGatePass: { findMany: (args: object) => Promise<{ gatePassNo: string }[]> } },
  companyId: number,
  visitorTypeValue: string
): Promise<string> {
  const prefix = 'GPN';
  const typeSlug = (visitorTypeValue || 'X').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const existing = await tx.visitorGatePass.findMany({
    where: { companyId, gatePassNo: { startsWith: `${prefix}/${typeSlug}/` } },
    select: { gatePassNo: true },
    orderBy: { gatePassNo: 'desc' },
    take: 1,
  });
  let max = 0;
  for (const row of existing) {
    const m = row.gatePassNo.match(/\/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}/${typeSlug}/${String(max + 1).padStart(4, '0')}`;
}

/**
 * Crypto-random URL-safe token for QR (32 bytes → 64 hex).
 */
export function generateQrToken(): string {
  return randomBytes(32).toString('hex');
}
