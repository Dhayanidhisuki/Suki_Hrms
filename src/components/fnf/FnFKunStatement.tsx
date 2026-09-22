'use client';

import type { KunAmtRow, KunFnfStatement } from '@/lib/fnf/kun-statement';

function cellAmt(n: number | null | undefined, dashZero = false): string {
  if (n == null || (dashZero && n === 0)) return '-';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const td = 'border border-[#9a9a9a] px-2 py-0.5';

function RowAmt({
  label,
  actual,
  earned,
  remark,
  strong,
  dashZero,
  mid,
}: {
  label: string;
  actual?: number | null;
  earned?: number | null;
  remark?: string;
  strong?: boolean;
  dashZero?: boolean;
  mid?: string;
}) {
  return (
    <tr className={strong ? 'font-semibold' : undefined}>
      <td className={td} colSpan={2}>
        {label}
      </td>
      {mid != null ? (
        <td className={`${td} text-center`}>{mid}</td>
      ) : (
        <td className={`${td} text-right tabular-nums`}>{cellAmt(actual, dashZero)}</td>
      )}
      <td className={`${td} text-right tabular-nums`}>{cellAmt(earned, dashZero)}</td>
      <td className={`${td} text-right text-[10px] font-semibold`} style={{ color: '#9b1c1c' }}>
        {remark ?? ''}
      </td>
    </tr>
  );
}

function Section({ title, extra }: { title: string; extra?: string }) {
  return (
    <tr style={{ backgroundColor: '#d8d8d8' }}>
      <td className={`${td} text-xs font-bold`} colSpan={extra ? 3 : 5}>
        {title}
      </td>
      {extra ? (
        <td className={`${td} text-right text-xs font-semibold`} colSpan={2}>
          {extra}
        </td>
      ) : null}
    </tr>
  );
}

export default function FnFKunStatement({ statement }: { statement: KunFnfStatement }) {
  return (
    <div
      className="mx-auto w-full max-w-[210mm] bg-white text-zinc-900 shadow-sm"
      style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif', border: '1px solid #bbb' }}
    >
      <div className="px-4 pb-2 pt-4">
        <p className="text-[20px] font-bold leading-tight">{statement.companyName}</p>
        <p className="text-[12px] leading-tight">{statement.companyAddress}</p>
        <p className="mt-1 text-[14px] font-bold">{statement.title}</p>
      </div>

      <table className="w-full border-collapse text-[11px]" style={{ border: '1px solid #9a9a9a' }}>
        <colgroup>
          <col style={{ width: '26%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td className={td}>Name of the employee</td>
            <td className={`${td} font-semibold`}>{statement.employeeName}</td>
            <td className={td}>F &amp; F Date</td>
            <td className={`${td} font-semibold`}>{statement.fnfDate}</td>
            <td className={`${td} text-center align-middle`} rowSpan={4}>
              <img src={statement.logoSrc} alt="KUN Aerospace" className="mx-auto h-10 w-auto" />
            </td>
          </tr>
          <tr>
            <td className={td}>Employee ID</td>
            <td className={`${td} font-semibold`}>{statement.employeeCode}</td>
            <td className={td}>Resignation Date</td>
            <td className={`${td} font-semibold`}>{statement.resignationDate}</td>
          </tr>
          <tr>
            <td className={td}>Designation</td>
            <td className={`${td} font-semibold`}>{statement.designation}</td>
            <td className={td}>Date of Joining</td>
            <td className={`${td} font-semibold`}>{statement.joinDate}</td>
          </tr>
          <tr>
            <td className={td}>Department</td>
            <td className={`${td} font-semibold`}>{statement.department}</td>
            <td className={td}>Date of Leaving</td>
            <td className={`${td} font-semibold`}>{statement.leavingDate}</td>
          </tr>
          <Section title="Salary Particulars" extra={`For the Month  ${statement.salaryMonth}`} />
          <tr>
            <td className={td}>Total Days in the Month</td>
            <td className={`${td} font-semibold`}>{statement.totalDays}</td>
            <td className={td}>Paid days</td>
            <td className={`${td} font-semibold`}>{statement.paidDays}</td>
            <td className={td} />
          </tr>
          <tr className="font-semibold">
            <td className={td} colSpan={2}>
              Earnings
            </td>
            <td className={`${td} text-center`}>Actual</td>
            <td className={`${td} text-center`}>Earned</td>
            <td className={td} />
          </tr>
          {statement.earnings.map((r: KunAmtRow) => (
            <RowAmt key={r.label} label={r.label} actual={r.actual} earned={r.earned} />
          ))}
          <RowAmt
            label="Total"
            actual={statement.earningTotalActual}
            earned={statement.earningTotalEarned}
            strong
          />
          <Section title="Less Deductions (-)" />
          {statement.deductions.map((r) => (
            <RowAmt key={r.label} label={r.label} actual={r.actual} earned={r.earned} dashZero />
          ))}
          <RowAmt
            label="Total Deductions"
            actual={statement.deductionTotalActual}
            earned={statement.deductionTotalEarned}
            dashZero
            strong
          />
          <RowAmt
            label="Net Salary (For Current Month)"
            actual={statement.netSalaryActual}
            earned={statement.netSalaryEarned}
            remark={statement.salaryStatus}
            strong
          />
          <Section title="Other Earnings" />
          <tr className="font-semibold">
            <td className={td} colSpan={2} />
            <td className={`${td} text-center`}>Eligibility Period</td>
            <td className={td} />
            <td className={td} />
          </tr>
          <RowAmt
            label="Earned Leave Encashment (Days)"
            mid={String(statement.leaveDays || '-')}
            earned={statement.leaveAmount}
          />
          <RowAmt
            label="Gratutity (Eligible)"
            mid={statement.gratuityPeriod}
            earned={statement.gratuityAmount}
            remark={statement.gratuityRemark}
          />
          <RowAmt
            label="Incentives"
            mid={statement.incentiveActual != null ? cellAmt(statement.incentiveActual) : '-'}
            earned={statement.incentiveEarned}
            remark={statement.incentiveRemark}
          />
          <RowAmt label="Bonus" mid={statement.bonusPeriod} earned={statement.bonusAmount} />
          <RowAmt label="Total" earned={statement.otherTotal} strong />
          <RowAmt
            label="Net Payable (Rs)"
            earned={statement.netPayable}
            remark={statement.netStatus}
            strong
          />
          <tr>
            <td className={`${td} py-2 font-semibold`}>Amount in Words</td>
            <td className={`${td} py-2`} colSpan={4}>
              {statement.amountInWords}
            </td>
          </tr>
          <tr>
            <td className={`${td} pt-3 font-semibold`}>Prepared By</td>
            <td className={`${td} pt-3 font-semibold`}>Verified By</td>
            <td className={`${td} pt-3 font-semibold`}>Approval 1</td>
            <td className={`${td} pt-3 font-semibold`} colSpan={2}>
              Approval 2
            </td>
          </tr>
          <tr>
            <td className={`${td} pb-3 text-[10px]`}>EXECUTIVE - HR</td>
            <td className={`${td} pb-3 text-[10px]`}>MANAGER - HR &amp; ADMIN</td>
            <td className={`${td} pb-3 text-[10px]`}>CEO</td>
            <td className={`${td} pb-3 text-[10px]`} colSpan={2}>
              FINANCE - HEAD
            </td>
          </tr>
          <Section title="Declaration" />
          <tr>
            <td className={`${td} px-2 py-2`} colSpan={5}>
              I have received full and final settlement of my account with the Company and confirm that all
              dues to me from the Company are cleared.
            </td>
          </tr>
          <tr>
            <td className={`${td} px-2 py-3`} colSpan={2}>
              Employee Signature <span className="ml-2 inline-block w-40 border-b border-zinc-400" />
            </td>
            <td className={`${td} px-2 py-3`} colSpan={3}>
              Date: <span className="ml-2 inline-block w-40 border-b border-zinc-400" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
