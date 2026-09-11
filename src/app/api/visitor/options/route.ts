import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';

const VISITOR_CATEGORIES = [
  'visitor_type',
  'visitor_purpose',
  'visitor_food_category',
  'visitor_food_type',
  'visitor_gadgets',
];

/**
 * GET /api/visitor/options
 * Bundles all dropdown options needed by the Visitor form.
 */
export async function GET(request: NextRequest) {
  const viewErr = await checkVisitorPermission(request, 'view');
  if (viewErr) return viewErr;

  const options: Record<string, { label: string; value: string }[]> = {};

  for (const category of VISITOR_CATEGORIES) {
    const rows = await prisma.dropdownMaster.findMany({
      where: { category, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { label: true, value: true },
    });
    options[category] = rows.map((r) => ({ label: r.label, value: r.value }));
  }

  return NextResponse.json(options);
}

/**
 * POST /api/visitor/options
 * Add a new value to one of the visitor dropdown categories.
 * Only company-admin can create new options (Vendor submodule).
 */
export async function POST(request: NextRequest) {
  const roleCode = request.headers.get('x-role-code');
  if (roleCode !== 'company-admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
  }

  const body = await request.json();
  const { category, label } = body;
  if (!category || !label || !VISITOR_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category or label' }, { status: 400 });
  }

  const value = (body.value ?? label).toString().toUpperCase().replace(/\s+/g, '_');

  const existing = await prisma.dropdownMaster.findFirst({
    where: { category, value, deletedAt: null },
  });
  if (existing) return NextResponse.json({ error: 'Value already exists in this category' }, { status: 409 });

  const row = await prisma.dropdownMaster.create({
    data: { category, label: label.toString().toUpperCase(), value, isActive: true, sortOrder: 0 },
  });
  return NextResponse.json(row, { status: 201 });
}
