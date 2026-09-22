import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOwnEmployeeId } from '@/lib/reportingManager';

export async function GET(request: NextRequest) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  const month = Number(request.nextUrl.searchParams.get('month') ?? new Date().getMonth() + 1);
  const year = Number(request.nextUrl.searchParams.get('year') ?? new Date().getFullYear());

  // For now, return mock OT data
  // In production, this would fetch from an OT or Overtime table
  const mockOTData = [
    {
      id: 1,
      date: `${year}-${String(month).padStart(2, '0')}-05`,
      hoursWorked: 10,
      otHours: 2,
      otType: 'REGULAR',
      status: 'APPROVED',
      rate: 45,
      amount: '90.00',
      remarks: 'Project deadline work',
    },
    {
      id: 2,
      date: `${year}-${String(month).padStart(2, '0')}-12`,
      hoursWorked: 12,
      otHours: 4,
      otType: 'WEEKEND',
      status: 'APPROVED',
      rate: 60,
      amount: '240.00',
      remarks: null,
    },
    {
      id: 3,
      date: `${year}-${String(month).padStart(2, '0')}-20`,
      hoursWorked: 9,
      otHours: 1,
      otType: 'REGULAR',
      status: 'PENDING',
      rate: 45,
      amount: '45.00',
      remarks: 'Awaiting approval',
    },
  ];

  return NextResponse.json({ data: mockOTData });
}

export async function GET_SINGLE(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const employeeId = await resolveOwnEmployeeId(userId);
  if (!employeeId) {
    return NextResponse.json({ error: 'This login has no linked employee record' }, { status: 403 });
  }

  // Mock data for single OT slip
  const mockOTRecord = {
    id: Number(params.id),
    date: '2026-09-05',
    hoursWorked: 10,
    otHours: 2,
    otType: 'REGULAR',
    status: 'APPROVED',
    rate: 45,
    amount: '90.00',
    remarks: 'Project deadline work',
  };

  return NextResponse.json(mockOTRecord);
}
