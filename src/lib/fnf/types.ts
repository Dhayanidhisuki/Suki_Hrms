export const FNF_CLEARANCE_CODES = ['MANAGER', 'IT', 'FINANCE', 'HR'] as const;
export type FnFClearanceCode = (typeof FNF_CLEARANCE_CODES)[number];

export const EXIT_TYPES = [
  'resignation',
  'termination',
  'retirement',
  'death',
  'absconding',
  'contract_expiry',
  'other',
] as const;

export type FnFLineDraft = {
  kind: 'EARNING' | 'DEDUCTION';
  code: string;
  name: string;
  source: 'SYSTEM' | 'MANUAL';
  amount: number;
  editable: boolean;
  remark?: string;
};

export type FnFCalculation = {
  unpaidSalary: number;
  leaveEncashment: number;
  leaveEncashmentDays: number;
  gratuity: number;
  bonusProportion: number;
  noticePay: number;
  loanRecovery: number;
  assetRecovery: number;
  otherPayments: number;
  otherDeductions: number;
  arrearsAmount: number;
  incentiveAmount: number;
  tdsDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  payableDays: number;
  salaryDivisor: number;
  noticeServedDays: number;
  noticeWaivedDays: number;
  noticeShortfallDays: number;
  totalPayable: number;
  totalRecovery: number;
  netPayable: number;
  snapshotJson: string;
  freezeSnapshotId?: number;
  lines: FnFLineDraft[];
};

export type FnFFreezeComponent = {
  salaryComponentId: number;
  code: string;
  name: string;
  type: string;
  amount: number;
  includeInGross: boolean;
  includeInPf: boolean;
  fnfPayable: boolean;
  fnfProration: string;
  fnfTaxable: boolean;
};

export type FnFFreezeContent = {
  frozenAt: string;
  employeeId: number;
  exitInterviewId: number;
  lastWorkingDay: string;
  exitType: string;
  noticeRequired: number;
  noticeServedDays: number;
  noticeWaivedDays: number;
  salaryDivisor: number;
  salaryDivisorMode: string;
  noticeRateBasis: string;
  periodStart: string;
  lastPayroll: { year: number; month: number; gross: number; tds: number; pf: number; esi: number; pt: number; status: string } | null;
  salaryAsOfLwd: { revisionId: number | null; grossSalary: number; components: FnFFreezeComponent[] };
  attendanceDays: { date: string; status: string; units: number }[];
  payableDays: number;
  leave: { typeCode: string; closingBalance: number; encashable: boolean }[];
  leaveEncashment: { denominator: number; basis: string; maxDays: number | null; includeEarnedOnly: boolean };
  gratuity: number;
  gratuityPaidOutside: boolean;
  bonus: number;
  bonusPaidOutside: boolean;
  bonusRatePercent: number;
  bonusEarnedBasic: number;
  arrears: number;
  incentive: number;
  incentivePaidOutside: boolean;
  loans: { id: number; outstanding: number }[];
  assets: { id: number; value: number }[];
  tdsYtd: { financialYear: number; grossYtd: number; tdsYtd: number };
  config: {
    includeUnpaidSalary: boolean;
    includeLeaveEncashment: boolean;
    includeGratuity: boolean;
    includeBonusProportion: boolean;
    includeNoticePay: boolean;
    includeLoanRecovery: boolean;
    includeAssetRecovery: boolean;
    includeTds: boolean;
    includePf: boolean;
    includeEsi: boolean;
    includePt: boolean;
    clearanceRequired: boolean;
  };
};
