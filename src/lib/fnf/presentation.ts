export function formatInr(v: string | number | null | undefined): string {
  return Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateIn(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatServicePeriod(joinDate: string | Date | null | undefined, asOf: string | Date | null | undefined): string {
  if (!joinDate || !asOf) return '—';
  const from = typeof joinDate === 'string' ? new Date(joinDate) : joinDate;
  const to = typeof asOf === 'string' ? new Date(asOf) : asOf;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return '—';
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} Year${years === 1 ? '' : 's'}, ${rem} Month${rem === 1 ? '' : 's'}`;
}

export const CARD_LINE_CODES = new Set(['LEAVE_ENCASHMENT', 'GRATUITY', 'BONUS', 'INCENTIVE']);

export type FnFDisplayLine = {
  id?: number;
  kind: 'EARNING' | 'DEDUCTION' | string;
  code: string;
  name: string;
  source?: string;
  amount: string | number;
  editable?: boolean;
  remark?: string | null;
};

export function lineByCode(lines: FnFDisplayLine[], code: string): FnFDisplayLine | undefined {
  return lines.find((l) => l.code === code);
}

export function splitStatementLines(lines: FnFDisplayLine[]): {
  salaryEarnings: FnFDisplayLine[];
  otherEarnings: FnFDisplayLine[];
  deductions: FnFDisplayLine[];
} {
  const salaryEarnings: FnFDisplayLine[] = [];
  const otherEarnings: FnFDisplayLine[] = [];
  const deductions: FnFDisplayLine[] = [];
  for (const l of lines) {
    if (l.kind === 'DEDUCTION') deductions.push(l);
    else if (CARD_LINE_CODES.has(l.code)) otherEarnings.push(l);
    else salaryEarnings.push(l);
  }
  return { salaryEarnings, otherEarnings, deductions };
}

export function parseFreezeJson(snapshotJson: string | null | undefined): {
  lastPayroll: { year: number; month: number; status: string; gross: number } | null;
    salaryAsOfLwd: {
      grossSalary: number;
      components: { code: string; name: string; amount: number; includeInPf?: boolean }[];
    };
  payableDays: number;
  salaryDivisor: number;
  noticeRequired: number;
  periodStart: string | null;
  gratuityPaidOutside?: boolean;
  bonusPaidOutside?: boolean;
  incentivePaidOutside?: boolean;
  bonusRatePercent?: number;
  bonusEarnedBasic?: number;
} | null {
  if (!snapshotJson) return null;
  try {
    const raw = JSON.parse(snapshotJson) as Record<string, unknown>;
    const lastPayroll = raw.lastPayroll as { year: number; month: number; status: string; gross: number } | null;
    const salaryAsOfLwd = (raw.salaryAsOfLwd as {
      grossSalary: number;
      components: { code: string; name: string; amount: number }[];
    }) ?? { grossSalary: 0, components: [] };
    return {
      lastPayroll: lastPayroll ?? null,
      salaryAsOfLwd,
      payableDays: Number(raw.payableDays ?? 0),
      salaryDivisor: Number(raw.salaryDivisor ?? 30),
      noticeRequired: Number(raw.noticeRequired ?? 0),
      periodStart: typeof raw.periodStart === 'string' ? raw.periodStart : null,
      gratuityPaidOutside: Boolean(raw.gratuityPaidOutside),
      bonusPaidOutside: Boolean(raw.bonusPaidOutside),
      incentivePaidOutside: raw.incentivePaidOutside !== false,
      bonusRatePercent: Number(raw.bonusRatePercent ?? 0),
      bonusEarnedBasic: Number(raw.bonusEarnedBasic ?? 0),
    };
  } catch {
    return null;
  }
}

export function componentAmount(
  freeze: { salaryAsOfLwd: { components: { code: string; amount: number }[] } } | null,
  code: string,
): number {
  if (!freeze) return 0;
  return freeze.salaryAsOfLwd.components
    .filter((c) => c.code === code)
    .reduce((s, c) => s + Number(c.amount), 0);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}
