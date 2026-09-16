import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { z } from 'zod';

const rejectSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const approverId = await resolveOwnEmployeeId(userId);
  if (!approverId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  try {
    const claim = await prisma.expenseReimbursement.findUnique({
      where: { id: Number(params.id) },
      select: { status: true },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Expense claim not found' }, { status: 404 });
    }

    if (claim.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Only submitted claims can be rejected' },
        { status: 400 }
      );
    }

    const updated = await prisma.expenseReimbursement.update({
      where: { id: Number(params.id) },
      data: {
        status: 'REJECTED',
        rejectionReason: parsed.data.rejectionReason,
        approvedBy: approverId,
        approvalDate: new Date(),
      },
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reject expense claim' },
      { status: 500 }
    );
  }
}
