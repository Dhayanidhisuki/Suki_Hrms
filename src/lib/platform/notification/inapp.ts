/**
 * The in-app inbox row. Writing it *is* delivery for the INAPP channel
 * (§14.3: "in-app message written" = Delivered). Shared by notify() and the
 * dispatcher's terminal fallback so neither imports the other.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export type InAppInput = {
  companyId: number;
  deliveryId?: number | null;
  recipientUserId?: number | null;
  recipientEmpId?: number | null;
  eventCode: string;
  title: string;
  body?: string | null;
  linkPath?: string | null;
  priority?: string;
};

export async function createInAppRow(input: InAppInput, db: Db = prisma): Promise<number> {
  const row = await db.notificationInApp.create({
    data: {
      companyId: input.companyId,
      deliveryId: input.deliveryId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      recipientEmpId: input.recipientEmpId ?? null,
      eventCode: input.eventCode,
      title: input.title.slice(0, 300),
      body: input.body ?? null,
      linkPath: input.linkPath ? input.linkPath.slice(0, 500) : null,
      priority: input.priority ?? 'NORMAL',
    },
    select: { id: true },
  });
  return row.id;
}
