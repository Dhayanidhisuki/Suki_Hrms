import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { amountInWordsInr } from '@/lib/fnf/amount-in-words';
import { calendarDaysInMonth } from '@/lib/fnf/rules';
import { formatServicePeriod, parseFreezeJson } from '@/lib/fnf/presentation';
import { fnfInclude } from '@/lib/fnf/include';
import { loadCompanyProfile } from '@/lib/company-profile';

export const KUN_LOGO_PUBLIC = '/branding/kun-logo.png';

export type KunAmtRow = {
  label: string;
  actual: number | null;
  earned: number | null;
  remark?: string;
};

export type KunFnfStatement = {
  companyName: string;
  companyAddress: string;
  logoSrc: string;
  title: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  fnfDate: string;
  resignationDate: string;
  joinDate: string;
  leavingDate: string;
  salaryMonth: string;
  totalDays: number;
  paidDays: number;
  earnings: KunAmtRow[];
  earningTotalActual: number;
  earningTotalEarned: number;
  deductions: KunAmtRow[];
  deductionTotalActual: number;
  deductionTotalEarned: number;
  netSalaryActual: number;
  netSalaryEarned: number;
  salaryStatus: string;
  leaveDays: number;
  leaveAmount: number;
  gratuityPeriod: string;
  gratuityAmount: number;
  gratuityRemark: string;
  incentiveActual: number | null;
  incentiveEarned: number;
  incentiveRemark: string;
  bonusPeriod: string;
  bonusAmount: number;
  otherTotal: number;
  netPayable: number;
  netStatus: string;
  amountInWords: string;
};

const EARNING_ORDER = [
  'Basic Salary',
  'HRA',
  'LTA',
  'Medical Allowances',
  'Education allowances',
  'Add. HRA',
];

export function earningTemplateLabel(code: string, name: string): string {
  const k = `${code} ${name}`.toUpperCase();
  if (/ADD(ITIONAL)?[.\s_-]*HRA|\bAHRA\b/.test(k)) return 'Add. HRA';
  if (/\bBASIC\b/.test(k)) return 'Basic Salary';
  if (/\bHRA\b/.test(k)) return 'HRA';
  if (/\bLTA\b|LEAVE\s*TRAVEL/.test(k)) return 'LTA';
  if (/MEDICAL/.test(k) && !/INSUR/.test(k)) return 'Medical Allowances';
  if (/EDU/.test(k)) return 'Education allowances';
  return name.trim() || code;
}

export function fyBounds(d: Date): { start: number; end: number } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return { start, end: start + 1 };
}

export function formatKunDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${dt.getUTCFullYear()}`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatKunMonth(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1] ?? month}-${year}`;
}

function sum(rows: KunAmtRow[], key: 'actual' | 'earned'): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

export function logoFilePath(): string {
  return path.join(process.cwd(), 'public/branding/kun-logo.png');
}

export async function readKunLogoBytes(): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(logoFilePath()));
  } catch {
    return null;
  }
}

export async function loadKunFnfStatement(settlementId: number): Promise<KunFnfStatement | null> {
  const s = await prisma.fnFSettlement.findUnique({
    where: { id: settlementId },
    include: fnfInclude,
  });
  if (!s) return null;

  const freezeRaw = s.snapshotJson ? (JSON.parse(s.snapshotJson) as Record<string, unknown>) : {};
  const freeze = parseFreezeJson(s.snapshotJson);
  const job = s.employee.jobInfos[0];
  const lwd = s.lastWorkingDay;
  const fy = fyBounds(lwd);
  const last = freeze?.lastPayroll;
  // The raw snapshot and the parsed freeze describe components slightly
  // differently — only one of them carries `type`. Declaring it optional here
  // says what the reader below already assumes: a component with no type is an
  // earning. Without this the `.type` read was a type error and, on the arm
  // that lacks it, silently undefined.
  const freezeComponents: Array<{ code: string; name: string; amount: number; type?: string }> = (
    (freezeRaw.salaryAsOfLwd as { components?: { code: string; name: string; amount: number; type?: string }[] } | undefined)
      ?.components ?? freeze?.salaryAsOfLwd.components ?? []
  );
  const salaryYear = last?.year ?? lwd.getUTCFullYear();
  const salaryMonth = last?.month ?? lwd.getUTCMonth() + 1;
  const totalDays = calendarDaysInMonth(salaryYear, salaryMonth);

  const payrollLine = last
    ? await prisma.payrollLine.findFirst({
        where: {
          employeeId: s.employeeId,
          payrollRun: { companyId: s.companyId, year: last.year, month: last.month },
        },
        include: { components: { include: { salaryComponent: true } } },
      })
    : null;

  const monthly = new Map<string, { label: string; actual: number }>();
  for (const c of freezeComponents) {
    if (String(c.type ?? 'earning').toLowerCase() === 'deduction') continue;
    const label = earningTemplateLabel(c.code, c.name);
    monthly.set(label, { label, actual: (monthly.get(label)?.actual ?? 0) + Number(c.amount) });
  }

  const earnedByLabel = new Map<string, number>();
  for (const c of payrollLine?.components ?? []) {
    const sc = c.salaryComponent;
    if (sc.type !== 'earning') continue;
    const label = earningTemplateLabel(sc.code, sc.name);
    earnedByLabel.set(label, (earnedByLabel.get(label) ?? 0) + Number(c.amount));
  }

  const salaryPaid = Number(s.unpaidSalary ?? 0) === 0 && Boolean(last);
  const paidDays = payrollLine ? Number(payrollLine.payableDays) : salaryPaid ? totalDays : Number(s.payableDays ?? 0);

  const earningLabels = [
    ...EARNING_ORDER.filter((l) => monthly.has(l) || earnedByLabel.has(l)),
    ...[...monthly.keys()].filter((l) => !EARNING_ORDER.includes(l)),
  ];
  const earnings: KunAmtRow[] = earningLabels.map((label) => ({
    label,
    actual: monthly.get(label)?.actual ?? null,
    earned: earnedByLabel.has(label)
      ? earnedByLabel.get(label)!
      : salaryPaid
        ? monthly.get(label)?.actual ?? null
        : monthly.get(label) && totalDays > 0
          ? Number(((monthly.get(label)!.actual / totalDays) * paidDays).toFixed(2))
          : null,
  }));

  const canteen = (payrollLine?.components ?? [])
    .filter((c) => /CANTEEN/.test(`${c.salaryComponent.code} ${c.salaryComponent.name}`.toUpperCase()))
    .reduce((sumV, c) => sumV + Number(c.amount), 0);
  const noticeDeduction = Number(s.noticePay) < 0 ? Math.abs(Number(s.noticePay)) : 0;
  const medicalIns = Number(payrollLine?.healthInsurance ?? 0);
  const epf = Number(payrollLine?.pfEmployee ?? 0);
  const pt = Number(payrollLine?.professionalTax ?? 0);
  const othersDed = Math.max(
    0,
    Number(payrollLine?.otherDeductionsTotal ?? 0) - canteen + Number(payrollLine?.lomAmount ?? 0),
  );

  const dash0 = (n: number): number | null => (n ? n : null);
  const deductions: KunAmtRow[] = [
    { label: 'EPF', actual: dash0(epf), earned: dash0(epf) },
    { label: 'Medical Insurance', actual: null, earned: dash0(medicalIns) },
    { label: 'Professional Tax', actual: dash0(pt), earned: dash0(pt) },
    { label: 'Canteen Deduction', actual: dash0(canteen), earned: dash0(canteen) },
    { label: 'Notice pay', actual: dash0(noticeDeduction), earned: dash0(noticeDeduction) },
    { label: 'Others', actual: dash0(othersDed), earned: dash0(othersDed) },
  ];

  const earningTotalActual = sum(earnings, 'actual');
  const earningTotalEarned = sum(earnings, 'earned');
  const deductionTotalActual = sum(deductions, 'actual');
  const deductionTotalEarned = sum(deductions, 'earned');
  const netSalaryEarned = payrollLine
    ? Number(payrollLine.netSalary)
    : earningTotalEarned - deductionTotalEarned;
  const netSalaryActual = earningTotalActual - deductionTotalActual;

  const leaveDays = Number(s.leaveEncashmentDays ?? 0);
  const leaveAmount = Number(s.leaveEncashment ?? 0);
  const gratuityAmount = Number(s.gratuity ?? freezeRaw.gratuity ?? 0);
  const gratuityPaidOutside = Boolean(freezeRaw.gratuityPaidOutside);
  const incentivePaidOutside = freezeRaw.incentivePaidOutside !== false;
  const incentiveEarned =
    Number(s.incentiveAmount) || Number(payrollLine?.performanceIncentive ?? freezeRaw.incentive ?? 0);
  const bonusAmount = Number(s.bonusProportion ?? freezeRaw.bonus ?? 0);
  const otherTotal = leaveAmount + gratuityAmount + incentiveEarned + bonusAmount;
  const netPayable = Number(s.netPayable ?? 0);

  // Company identity comes from the Company record. This used to regex-sniff
  // `description` for "chennai|plot|estate" to guess at an address, fall back
  // to a hard-coded KUN constant, and override the company name outright for
  // anything matching /KUN/ — so a second company printed KUN's letterhead.
  const profile = await loadCompanyProfile(s.companyId);

  return {
    companyName: profile?.name ?? s.company.name,
    companyAddress: profile?.address ?? '',
    logoSrc: KUN_LOGO_PUBLIC,
    title: `Full & Final Settlement_${fy.start}-${fy.end}`,
    employeeName: `${s.employee.firstName} ${s.employee.lastName}`.trim().toUpperCase(),
    employeeCode: s.employee.oldEmployeeCode ?? '',
    designation: job?.designation?.name ?? '',
    department: job?.department?.name ?? '',
    fnfDate: formatKunDate(s.settlementDate ?? s.updatedAt),
    resignationDate: formatKunDate(s.exitInterview.resignationDate ?? s.exitInterview.exitDate),
    joinDate: formatKunDate(job?.joinDate),
    leavingDate: formatKunDate(lwd),
    salaryMonth: formatKunMonth(salaryYear, salaryMonth),
    totalDays,
    paidDays,
    earnings,
    earningTotalActual,
    earningTotalEarned,
    deductions,
    deductionTotalActual,
    deductionTotalEarned,
    netSalaryActual: salaryPaid ? 0 : netSalaryActual,
    netSalaryEarned,
    salaryStatus: salaryPaid ? 'SALARY PAID' : '',
    leaveDays,
    leaveAmount,
    gratuityPeriod: formatServicePeriod(job?.joinDate, lwd),
    gratuityAmount,
    gratuityRemark: gratuityPaidOutside ? 'LIC - TO BE PAID' : gratuityAmount > 0 ? 'ELIGIBLE' : '',
    incentiveActual: dash0(Number(payrollLine?.performanceIncentive ?? 0)),
    incentiveEarned,
    incentiveRemark: incentivePaidOutside && incentiveEarned > 0 ? 'PMS PAID' : '',
    bonusPeriod: `FY: ${fy.start} - ${fy.end}`,
    bonusAmount,
    otherTotal,
    netPayable,
    netStatus: netPayable !== 0 ? 'YET TO BE PAID' : '',
    amountInWords: amountInWordsInr(netPayable),
  };
}
