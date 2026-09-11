/**
 * GET /api/payroll/runs/[id]/bank-file?templateId=X
 *
 * Generates a bank transfer file for a payroll run using the specified
 * BankFileTemplate. Returns CSV/TXT content directly (or JSON with the
 * file content for XLSX/FIXED_WIDTH — Phase 3 stub). Only includes lines
 * with status OK and net salary > 0. Employees without bank details are
 * flagged in the response so HR can follow up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';

interface ColumnDef {
  field: string;
  label?: string;
  width?: number;
  pad?: 'left' | 'right';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { id } = await params;
  const runId = parseInt(id);
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get('templateId');

  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, companyId: scope.companyId },
  });
  if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });

  // Load the template (first active if not specified).
  const template = templateId
    ? await prisma.bankFileTemplate.findFirst({ where: { id: parseInt(templateId), companyId: scope.companyId } })
    : await prisma.bankFileTemplate.findFirst({ where: { companyId: scope.companyId, isActive: true } });
  if (!template) {
    return NextResponse.json({ error: 'No bank file template configured. Create one under Masters > Bank File Templates.' }, { status: 400 });
  }

  // Load all OK lines with employee bank details.
  const lines = await prisma.payrollLine.findMany({
    where: { payrollRunId: runId, status: 'OK' },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          bankDetail: true,
        },
      },
    },
    orderBy: { employeeId: 'asc' },
  });

  const eligible = lines.filter((l) => Number(l.netSalary) > 0);
  const missingBank = eligible.filter((l) => !l.employee.bankDetail?.accountNumber);
  const withBank = eligible.filter((l) => l.employee.bankDetail?.accountNumber);

  // Parse column mapping JSON.
  let columns: ColumnDef[] = [];
  try {
    columns = JSON.parse(template.columnMapping);
  } catch {
    return NextResponse.json({ error: 'Invalid column mapping JSON in template' }, { status: 500 });
  }

  // Build rows.
  const rows: string[] = [];

  // Header row.
  if (template.headerRow) {
    rows.push(columns.map((c) => c.label ?? c.field).join(template.delimiter));
  }

  // Data rows.
  for (const line of withBank) {
    const emp = line.employee;
    const bank = emp.bankDetail!;
    const fieldValues: Record<string, string> = {
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      bankName: bank.bankName ?? '',
      accountNumber: bank.accountNumber ?? '',
      ifscCode: bank.ifscCode ?? '',
      branchName: bank.branchName ?? '',
      netSalary: Number(line.netSalary).toFixed(2),
      grossEarnings: Number(line.grossEarnings).toFixed(2),
      month: String(run.month),
      year: String(run.year),
      payrollRunId: String(run.id),
    };
    const row = columns.map((c) => {
      const val = fieldValues[c.field] ?? '';
      if (c.width && template.fileFormat === 'FIXED_WIDTH') {
        const padChar = ' ';
        return c.pad === 'left' ? val.padStart(c.width, padChar) : val.padEnd(c.width, padChar);
      }
      return val;
    });
    rows.push(row.join(template.delimiter));
  }

  // Footer row.
  if (template.footerRow && template.footerTemplate) {
    const totalAmount = withBank.reduce((sum, l) => sum + Number(l.netSalary), 0);
    const footer = template.footerTemplate
      .replace('{count}', String(withBank.length))
      .replace('{total}', totalAmount.toFixed(2));
    rows.push(footer);
  }

  const content = rows.join('\n');

  // Return as downloadable file for CSV/TXT, JSON for others.
  if (template.fileFormat === 'CSV' || template.fileFormat === 'TXT' || template.fileFormat === 'FIXED_WIDTH') {
    const filename = `bank-file-${run.year}-${String(run.month).padStart(2, '0')}-${template.code}.csv`;
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({
    content,
    template,
    summary: {
      totalEmployees: withBank.length,
      missingBankDetails: missingBank.length,
      missingBankEmployees: missingBank.map((l) => ({
        employeeCode: l.employee.employeeCode,
        name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
      })),
      totalAmount: withBank.reduce((sum, l) => sum + Number(l.netSalary), 0),
    },
  });
}
