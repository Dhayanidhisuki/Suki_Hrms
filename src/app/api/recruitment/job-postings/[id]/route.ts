/**
 * Job Posting [id] — PATCH (status update for approval workflow), DELETE.
 * BRD §16.3.3 — Hiring Approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { z } from 'zod';

const postingInclude = {
  department: { select: { id: true, name: true, code: true } },
  designation: { select: { id: true, name: true, code: true } },
  jobDescription: { select: { id: true, jdCode: true, title: true, status: true } },
  createdBy: { select: { id: true, email: true } },
};

const patchSchema = z.object({
  status: z.string().min(1).max(20).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.jobPosting.findUnique({ where: { id: parseInt(id) }, include: postingInclude });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.jobPosting.findUnique({ where: { id: parseInt(id) } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) updateData.status = parsed.data.status;

  const record = await prisma.jobPosting.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: postingInclude,
  });

  return NextResponse.json(record);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;

  const { id } = await params;
  await prisma.jobPosting.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
  return NextResponse.json({ message: 'Deleted' }, { status: 200 });
}
