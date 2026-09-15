import { z } from 'zod';

const GNR_STATUSES = [
  'DRAFT', 'DC_CAPTURED', 'GNR_CREATED', 'AWAITING_AUTHORIZATION', 'AUTHORIZED',
  'INWARD_RECORDED', 'OUTWARD_RECORDED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED',
  'COMPLETED', 'CANCELLED', 'REJECTED', 'EXCEPTION_PENDING',
] as const;

export const gnrSchema = z.object({
  dcNo: z.string().min(1).max(100),
  dcDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  movementType: z.enum(['MATERIAL_INWARD', 'MATERIAL_OUTWARD', 'RETURNABLE', 'NON_RETURNABLE', 'SERVICE_REPAIR']),
  counterpartyType: z.string().max(20).optional().or(z.literal('')),
  counterpartyName: z.string().max(200).optional().or(z.literal('')),
  transporterName: z.string().max(200).optional().or(z.literal('')),
  sourceLocation: z.string().max(200).optional().or(z.literal('')),
  destinationLocation: z.string().max(200).optional().or(z.literal('')),
  contactName: z.string().max(100).optional().or(z.literal('')),
  contactMobile: z.string().regex(/^\d{10}$/, 'Contact mobile must be 10 digits').optional().or(z.literal('')),
  purchaseOrderRef: z.string().max(100).optional().or(z.literal('')),
  workOrderRef: z.string().max(100).optional().or(z.literal('')),
  authorizationRef: z.string().max(100).optional().or(z.literal('')),
  vehicleNumber: z.string().max(20).optional().or(z.literal('')),
  vehicleType: z.string().max(50).optional().or(z.literal('')),
  driverName: z.string().max(100).optional().or(z.literal('')),
  driverMobile: z.string().regex(/^\d{10}$/, 'Driver mobile must be 10 digits').optional().or(z.literal('')),
  driverId: z.string().max(50).optional().or(z.literal('')),
  gateId: z.string().max(50).optional().or(z.literal('')),
  dcDocumentUrl: z.string().max(500).optional().or(z.literal('')),
  supportingDocumentUrl: z.string().max(500).optional().or(z.literal('')),
  remarks: z.string().max(500).optional().or(z.literal('')),
  lineItems: z.array(z.object({
    materialDescription: z.string().min(1).max(500),
    itemCode: z.string().max(100).optional().or(z.literal('')),
    quantity: z.coerce.number().min(0).optional(),
    unit: z.string().max(30).optional().or(z.literal('')),
    packageCount: z.coerce.number().int().min(0).optional(),
    returnable: z.union([z.boolean(), z.enum(['YES', 'NO'])]).transform((v) => v === true || v === 'YES').default(false),
    remarks: z.string().max(500).optional().or(z.literal('')),
  })).min(1, 'At least one material line item is required'),
});

export type GNRInput = z.infer<typeof gnrSchema>;

export function formatGnrStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    DC_CAPTURED: 'DC Captured',
    GNR_CREATED: 'GNR Created',
    AWAITING_AUTHORIZATION: 'Awaiting Authorization',
    AUTHORIZED: 'Authorized',
    INWARD_RECORDED: 'Inward Recorded',
    OUTWARD_RECORDED: 'Outward Recorded',
    ACKNOWLEDGED: 'Acknowledged',
    PARTIALLY_RECEIVED: 'Partially Received',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected',
    EXCEPTION_PENDING: 'Exception Pending',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

export function gnrStatusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'DRAFT':
    case 'DC_CAPTURED':
    case 'GNR_CREATED':
      return { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
    case 'AWAITING_AUTHORIZATION':
      return { bg: 'var(--warning-soft)', fg: 'var(--warning)' };
    case 'AUTHORIZED':
    case 'ACKNOWLEDGED':
      return { bg: 'var(--accent-soft)', fg: 'var(--accent)' };
    case 'INWARD_RECORDED':
    case 'OUTWARD_RECORDED':
      return { bg: 'var(--info-soft)', fg: 'var(--info)' };
    case 'COMPLETED':
      return { bg: 'var(--success-soft)', fg: 'var(--success)' };
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXCEPTION_PENDING':
    case 'PARTIALLY_RECEIVED':
      return { bg: 'var(--danger-soft)', fg: 'var(--danger)' };
    default:
      return { bg: 'var(--surface-muted)', fg: 'var(--foreground-muted)' };
  }
}

export async function generateGnrNo(
  tx: { gateNumberRegister: { findMany: (args: object) => Promise<{ gnrNo: string }[]> } },
  companyId: number,
  movementType: string
): Promise<string> {
  const prefix = 'GNR';
  const typeSlug = (movementType || 'X').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const existing = await tx.gateNumberRegister.findMany({
    where: { companyId, gnrNo: { startsWith: `${prefix}/${typeSlug}/` } },
    select: { gnrNo: true },
    orderBy: { gnrNo: 'desc' },
    take: 1,
  });
  let max = 0;
  for (const row of existing) {
    const m = row.gnrNo.match(/\/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}/${typeSlug}/${String(max + 1).padStart(4, '0')}`;
}
