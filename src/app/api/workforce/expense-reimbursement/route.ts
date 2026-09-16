import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';
import { z } from 'zod';

const expenseItemSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1).max(500),
  amount: z.number().min(0.01),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createClaimSchema = z.object({
  purpose: z.string().min(1).max(100),
  description: z.string().optional(),
  items: z.array(expenseItemSchema).min(1),
});

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  try {
    const claims = await prisma.expenseReimbursement.findMany({
      where: { employeeId, deletedAt: null },
      include: { items: true },
      orderBy: { submissionDate: 'desc' },
    });
    return NextResponse.json({ data: claims });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch expense claims' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const data = parsed.data;
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    const claim = await prisma.expenseReimbursement.create({
      data: {
        companyId: employee.companyId,
        employeeId,
        purpose: data.purpose,
        description: data.description || null,
        totalAmount,
        status: 'SUBMITTED',
        createdByUserId: userId,
        items: {
          create: data.items.map((item) => ({
            category: item.category,
            description: item.description,
            amount: item.amount,
            receiptDate: new Date(item.receiptDate),
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create expense claim' },
      { status: 500 }
    );
  }
}
