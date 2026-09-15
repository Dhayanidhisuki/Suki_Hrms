import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVisitorPermission } from '@/lib/rbac-visitor';
import { getCompanyId } from '@/lib/companyScope';
import { generateGatePassPdf } from '@/lib/visitor-pdf';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permErr = await checkVisitorPermission(request, 'export');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const passId = Number(id);
  if (isNaN(passId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const pass = await prisma.visitorGatePass.findFirst({
    where: { id: passId, companyId: scope.companyId, deletedAt: null },
    include: {
      company: { select: { name: true } },
      personToMeet: { select: { firstName: true, lastName: true, employeeCode: true, oldEmployeeCode: true } },
    },
  });
  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const pdf = await generateGatePassPdf(pass);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="gate-pass-${pass.gatePassNo.replace(/\//g, '-')}.pdf"`,
    },
  });
}
