/**
 * Employee ID Configuration — singleton config (BRD §9).
 * GET  /api/masters/employee-id-config   — get current config
 * PUT  /api/masters/employee-id-config   — update config
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkMasterPermission } from '@/lib/rbac-masters';
import { employeeIdConfigSchema } from '@/lib/validations/recruitment';

export async function GET(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  let config = await prisma.employeeIdConfig.findFirst();
  if (!config) {
    config = await prisma.employeeIdConfig.create({ data: {} });
  }
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const permErr = await checkMasterPermission(request);
  if (permErr) return permErr;
  const body = await request.json();
  const parsed = employeeIdConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  let config = await prisma.employeeIdConfig.findFirst();
  if (!config) {
    config = await prisma.employeeIdConfig.create({ data: parsed.data });
  } else {
    config = await prisma.employeeIdConfig.update({ where: { id: config.id }, data: parsed.data });
  }
  return NextResponse.json(config);
}
