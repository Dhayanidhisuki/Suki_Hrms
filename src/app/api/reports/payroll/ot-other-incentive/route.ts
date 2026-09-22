/**
 * GET /api/reports/payroll/ot-other-incentive
 *   ?year=&month=&view=employee|department|trend&department=&search=&format=csv
 *
 * OT & Other Incentive Register — the automated form of KUN's manual
 * "Overtime Salary Register" workbook. Column set, the Tot OC Ear formula
 * and the ESI split are all documented and verified in
 * src/lib/payroll/otIncentiveRegister.ts.
 *
 * `view=trend` returns the trailing-12-month comparison matrix instead of
 * employee rows. The department summary always rides along with the
 * employee view — it is derived from the same rows, so the two cannot
 * disagree.
 *
 * When no payroll run exists for the period this returns 200 with
 * `run: null` and an empty result rather than 404: the OT figures come from
 * the same function payroll itself calls, so there is deliberately no
 * raw-attendance approximation to fall back to.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkSpecificPermission } from '@/lib/rbac-employee';
import { getCompanyId } from '@/lib/companyScope';
import {
  computeOtIncentiveRegister,
  computeOtIncentiveTrend,
  csvLine,
  type OtIncentiveRegisterRow,
} from '@/lib/payroll/otIncentiveRegister';

const REGISTER_HEADERS = [
  'Sl No', 'Emp ID', 'Employee Name', 'Month/Year', 'Category', 'Department',
  'Designation', 'Date of Joining', 'Gender', 'Basic (Th)', 'OT Hrs', 'OT Value',
  'OT Amount', 'OT Mon Incentive', 'OT Weekly Inc', 'DM_INC', 'ATT_BONUS',
  'Shift Incentive', 'Employee Referral', 'Petrol Allowance', 'Performance Incentive',
  'Tot OC Ear', 'OC Empl ESI', 'OC Emplr ESI', 'Tot OC Net',
  'Bank A/c No', 'Bank IFSC', 'Bank Name', 'Remarks',
];

function registerCells(r: OtIncentiveRegisterRow): unknown[] {
  return [
    r.slNo, r.employeeCode, r.employeeName, r.monthYearLabel, r.category ?? '',
    r.department ?? '', r.designation ?? '', r.dateOfJoining ?? '', r.gender ?? '',
    r.basic.toFixed(2), r.otHours.toFixed(2), r.otValue === null ? '' : r.otValue.toFixed(2),
    r.otAmount.toFixed(2), r.otMonthlyIncentive.toFixed(2), r.otWeeklyIncentive.toFixed(2),
    r.doubleMachineIncentive.toFixed(2), r.attendanceBonus.toFixed(2), r.shiftIncentive.toFixed(2),
    r.employeeReferral.toFixed(2), r.petrolAllowance.toFixed(2), r.performanceIncentive.toFixed(2),
    r.totOcEarnings.toFixed(2), r.ocEmployeeEsi.toFixed(2),
    r.ocEmployerEsi.toFixed(2), r.totOcNet.toFixed(2), r.bankAccountNumber ?? '',
    r.bankIfsc ?? '', r.bankName ?? '', r.remarks,
  ];
}

export async function GET(request: NextRequest) {
  const permErr = await checkSpecificPermission(request, 'payroll.processing.view');
  if (permErr) return permErr;
  const scope = getCompanyId(request);
  if ('error' in scope) return scope.error;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);
  const month = parseInt(searchParams.get('month') ?? '', 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
  }

  const view = searchParams.get('view') ?? 'employee';
  const format = searchParams.get('format');
  const department = searchParams.get('department')?.trim() || undefined;
  const search = searchParams.get('search')?.trim() || undefined;

  // ── Trend view ──
  if (view === 'trend') {
    const trend = await computeOtIncentiveTrend(scope.companyId, year, month, 12);
    if (format === 'csv') {
      const header = csvLine(['SL.NO', 'Overtime Comparison', ...trend.periods.map((p) => p.label)]);
      const body = trend.rows.map((r, i) =>
        csvLine([i + 1, r.category, ...r.values.map((v) => (v === null ? '' : v.toFixed(2)))])
      );
      return new NextResponse([header, ...body].join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ot_incentive_trend_${year}_${String(month).padStart(2, '0')}.csv"`,
        },
      });
    }
    return NextResponse.json(trend);
  }

  // ── Employee + department views ──
  const result = await computeOtIncentiveRegister(scope.companyId, year, month, {
    department,
    search,
  });

  if (format === 'csv') {
    if (!result.run) {
      return NextResponse.json({ error: 'No payroll run for this period — run payroll first.' }, { status: 409 });
    }
    if (view === 'department') {
      const header = csvLine([
        'Department', 'OT Hrs', 'OT', 'Cumulative (OT Mon Inc)', 'Shift Cont (OT Weekly Inc)',
        'DM_INC', 'ATT_BONUS', 'Extra Work', 'Employee Referral', 'Shift Incentive', 'Tot OC Ear',
      ]);
      const body = result.departmentSummary.map((d) =>
        csvLine([
          d.department, d.otHours.toFixed(2), d.otAmount.toFixed(2), d.otMonthlyIncentive.toFixed(2),
          d.otWeeklyIncentive.toFixed(2), d.doubleMachineIncentive.toFixed(2), d.attendanceBonus.toFixed(2),
          d.extraWork.toFixed(2), d.employeeReferral.toFixed(2), d.shiftIncentive.toFixed(2), d.totOcEarnings.toFixed(2),
        ])
      );
      const grand = csvLine([
        'Grand Total', result.totals.otHours.toFixed(2), result.totals.otAmount.toFixed(2),
        result.totals.otMonthlyIncentive.toFixed(2), result.totals.otWeeklyIncentive.toFixed(2),
        result.totals.doubleMachineIncentive.toFixed(2), result.totals.attendanceBonus.toFixed(2),
        result.totals.extraWork.toFixed(2), result.totals.employeeReferral.toFixed(2),
        result.totals.shiftIncentive.toFixed(2), result.totals.totOcEarnings.toFixed(2),
      ]);
      return new NextResponse([header, ...body, grand].join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ot_incentive_department_${year}_${String(month).padStart(2, '0')}.csv"`,
        },
      });
    }

    const csv = [csvLine(REGISTER_HEADERS), ...result.rows.map((r) => csvLine(registerCells(r)))].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ot_incentive_register_${year}_${String(month).padStart(2, '0')}.csv"`,
      },
    });
  }

  return NextResponse.json(result);
}
